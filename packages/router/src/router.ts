// ============================================================
// createRouter — 路由实例（仿 Vue Router 最小版）
//   核心：currentRoute 为 reactive 状态，
//   RouterView 渲染时读取它 → 路由变化自动触发组件切换
// ============================================================

import { reactive } from '@actview/core'
import { createMatcher, type RouteRecord, type MatchedRoute } from './matcher'
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

function stringifyQuery(query?: Record<string, string | number | boolean>): string {
  if (!query) return ''
  const entries = Object.entries(query)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return entries.length ? `?${entries.join('&')}` : ''
}

export function createRouter(options: RouterOptions) {
  const history = options.history
  const matcher = createMatcher(options.routes)

  const currentRoute = reactive<RouteLocation>({
    path: '/',
    query: {},
    params: {},
    fullPath: '/',
  })

  /** 解析导航目标：字符串或 { path, query } =》 { fullPath } */
  function resolve(to: string | RouteLocationRaw): { fullPath: string } {
    if (typeof to === 'string') return { fullPath: to }
    const path = to.path ?? '/'
    return { fullPath: path + stringifyQuery(to.query) }
  }

  /** 根据完整路径（含 query）更新 currentRoute */
  function updateRoute(fullPath: string) {
    const [path, search = ''] = fullPath.split('?')
    const matched: MatchedRoute | null = matcher.match(path)
    currentRoute.fullPath = fullPath
    currentRoute.path = path
    currentRoute.query = parseQuery(search)
    // 未匹配时 params 置空，matched 记录由 RouterView 自行处理
    currentRoute.params = matched ? matched.params : {}
  }

  // 路由变化统一由 history 事件驱动，push/replace/back 都走这里
  history.listen((to) => updateRoute(to))

  // 初始化当前路由
  updateRoute(history.location)

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
    /** 匹配 path =》 { record, params }（RouterView 渲染用） */
    match(path) {
      return matcher.match(path)
    },
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
  match(path: string): MatchedRoute | null
}
