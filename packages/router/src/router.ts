// ============================================================
// createRouter — 路由实例（仿 Vue Router 最小版）
//   核心：currentRoute 为 reactive 状态，
//   RouterView 渲染时读取它 → 路由变化自动触发组件切换
//   能力：嵌套路由（children）、导航守卫（beforeEach/afterEach/beforeEnter）、
//         redirect、懒加载组件（component: () => import()）
// ============================================================

import { reactive } from '@actview/core'
import {
  createMatcher,
  type RouteRecord,
  type MatchedRoute,
  type NavigationGuard
} from './matcher'
import type { RouterHistory } from './history'

export interface RouterOptions {
  history: RouterHistory
  routes: RouteRecord[]
}

export interface RouteLocationRaw {
  path?: string
  query?: Record<string, string | number | boolean>
}

export interface RouteLocation {
  /** 匹配到的实际路径（不含 query） */
  path: string
  query: Record<string, string>
  params: Record<string, string>
  fullPath: string
  /** 根到叶子的匹配链（嵌套路由） */
  matched: MatchedRoute[]
}

/** 当前活动的 router（现阶段为单例，createRouter 时设置） */
export let currentRouter: Router = null as any

function parseQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {}
  if (!search) return query
  search
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .forEach((pair) => {
      const [k, ...rest] = pair.split('=')
      query[decodeURIComponent(k)] = decodeURIComponent(rest.join('=') || '')
    })
  return query
}

function stringifyQuery(
  query?: Record<string, string | number | boolean>
): string {
  if (!query) return ''
  const entries = Object.entries(query)
    .filter(([, v]) => v != null)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
  return entries.length ? `?${entries.join('&')}` : ''
}

/** 守卫返回值判定：重定向目标 */
function isRedirect(
  result: any
): result is string | { path: string } {
  return (
    typeof result === 'string' ||
    (result != null && typeof result === 'object' && 'path' in result)
  )
}

export function createRouter(options: RouterOptions) {
  const history = options.history
  const matcher = createMatcher(options.routes)

  const currentRoute = reactive<RouteLocation>({
    path: '/',
    query: {},
    params: {},
    fullPath: '/',
    matched: []
  })

  const beforeGuards: NavigationGuard[] = []
  const afterHooks: ((to: RouteLocation, from: RouteLocation) => void)[] = []

  /** 解析导航目标：字符串或 { path, query } =》 { fullPath } */
  function resolve(to: string | RouteLocationRaw): { fullPath: string } {
    if (typeof to === 'string') return { fullPath: to }
    const path = to.path ?? '/'
    return { fullPath: path + stringifyQuery(to.query) }
  }

  /** 构建 RouteLocation（含匹配链） */
  function buildLocation(fullPath: string): RouteLocation {
    const [path, search = ''] = fullPath.split('?')
    const matched = matcher.match(path)
    const leaf = matched && matched.length ? matched[matched.length - 1] : null
    return {
      path,
      query: parseQuery(search),
      fullPath,
      params: leaf ? leaf.params : {},
      matched: matched ?? []
    }
  }

  /** 应用导航结果到 currentRoute（同步） */
  function applyLocation(to: RouteLocation) {
    currentRoute.path = to.path
    currentRoute.query = to.query
    currentRoute.params = to.params
    currentRoute.fullPath = to.fullPath
    currentRoute.matched = to.matched
  }

  /** 收集本次导航的守卫：全局 beforeEach + 匹配链各路由级 beforeEnter */
  function collectGuards(matched: MatchedRoute[]): NavigationGuard[] {
    const routeGuards = matched
      .map((m) => m.record.beforeEnter)
      .filter(Boolean) as NavigationGuard[]
    return [...beforeGuards, ...routeGuards]
  }

  function runAfterHooks(to: RouteLocation, from: RouteLocation) {
    for (const hook of afterHooks) hook(to, from)
  }

  /** 串行执行守卫，返回第一个非放行结果 */
  async function runGuards(
    guards: NavigationGuard[],
    to: RouteLocation,
    from: RouteLocation
  ): Promise<any> {
    for (const guard of guards) {
      const result = await guard(to, from)
      if (result !== undefined && result !== true) {
        return result // false 取消 / 重定向目标
      }
    }
    return true
  }

  /** 导航入口：无守卫同步执行；有守卫异步执行 */
  function navigate(fullPath: string): Promise<void> | void {
    const to = buildLocation(fullPath)
    const from = { ...currentRoute, matched: currentRoute.matched.slice() }

    // redirect：叶子路由声明 redirect 时，导航到目标
    const leaf = to.matched.length ? to.matched[to.matched.length - 1].record : null
    if (leaf?.redirect) {
      const target =
        typeof leaf.redirect === 'string' ? leaf.redirect : leaf.redirect.path
      if (target !== fullPath) {
        return navigate(target)
      }
    }

    const guards = collectGuards(to.matched)

    if (guards.length === 0) {
      applyLocation(to)
      runAfterHooks(to, from)
      return
    }

    // 有守卫：串行异步执行
    return runGuards(guards, to, from).then((result) => {
      if (result === false) return // 取消导航
      if (isRedirect(result)) {
        const target = typeof result === 'string' ? result : result.path
        return navigate(target)
      }
      applyLocation(to)
      runAfterHooks(to, from)
    })
  }

  // 路由变化统一由 history 事件驱动，push/replace/back 都走这里
  history.listen((to) => {
    navigate(to)
  })

  // 初始化当前路由
  navigate(history.location)

  const router: Router = {
    currentRoute,
    push(to) {
      history.push(resolve(to).fullPath)
    },
    replace(to) {
      history.replace(resolve(to).fullPath)
    },
    back() {
      history.go(-1)
    },
    forward() {
      history.go(1)
    },
    go(delta) {
      history.go(delta)
    },
    resolve,
    /** 匹配 path =》 MatchedRoute[]（RouterView 渲染用） */
    match(path) {
      return matcher.match(path)
    },
    beforeEach(guard) {
      beforeGuards.push(guard)
      return () => {
        const i = beforeGuards.indexOf(guard)
        if (i >= 0) beforeGuards.splice(i, 1)
      }
    },
    afterEach(hook) {
      afterHooks.push(hook)
      return () => {
        const i = afterHooks.indexOf(hook)
        if (i >= 0) afterHooks.splice(i, 1)
      }
    }
  }

  currentRouter = router
  return router
}

export interface Router {
  /** 响应式当前路由：RouterView 渲染时读取，变化即触发组件切换 */
  currentRoute: RouteLocation
  push(to: string | RouteLocationRaw): void
  replace(to: string | RouteLocationRaw): void
  back(): void
  forward(): void
  go(delta: number): void
  resolve(to: string | RouteLocationRaw): { fullPath: string }
  match(path: string): MatchedRoute[] | null
  /** 注册全局前置守卫，返回取消函数 */
  beforeEach(guard: NavigationGuard): () => void
  /** 注册全局后置钩子，返回取消函数 */
  afterEach(hook: (to: RouteLocation, from: RouteLocation) => void): () => void
}
