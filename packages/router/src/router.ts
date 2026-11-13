// ============================================================
// @actview/router — Router
//
// createRouter({ history, routes }).use? 作为 app 插件：
//   createApp(App).use(router).mount('#app')
// ============================================================

import { shallowReactive } from '@actview/reactivity'
import type { App, AppPlugin } from '@actview/core'
import {
  createMatcher,
  fillNamedPath,
  normalizePath,
  parseLocationString,
  stringifyQuery,
  type Matcher,
} from './matcher'
import type {
  NavigationGuard,
  NavigationGuardResult,
  NavigationResult,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  RouteRecordRaw,
  RouterOptions,
} from './types'

export const routerKey: unique symbol = Symbol.for('actview.router')
export const viewDepthKey: unique symbol = Symbol.for('actview.router.viewDepth')

export class Router implements AppPlugin {
  readonly options: RouterOptions
  readonly history
  private readonly matcher: Matcher
  private readonly state
  private readonly beforeEachGuards: NavigationGuard[] = []
  private readonly afterEachGuards: Array<
    (to: RouteLocationNormalized, from: RouteLocationNormalized) => void
  > = []
  private navigationId = 0

  constructor(options: RouterOptions) {
    this.options = options
    this.history = options.history
    this.matcher = createMatcher(options.routes)
    this.state = shallowReactive({
      currentRoute: this.resolveInitial(),
    })
  }

  get currentRoute(): RouteLocationNormalized {
    return this.state.currentRoute
  }

  get routes(): RouteRecord[] {
    return this.matcher.records
  }

  install(app: App): void {
    app.provide(routerKey, this)
    const stop = this.history.listen((location) => {
      void this.navigate(location, true)
    })
    app.onUnmount(() => {
      stop()
    })
  }

  beforeEach(guard: NavigationGuard): () => void {
    this.beforeEachGuards.push(guard)
    return () => {
      const index = this.beforeEachGuards.indexOf(guard)
      if (index >= 0) this.beforeEachGuards.splice(index, 1)
    }
  }

  afterEach(
    hook: (to: RouteLocationNormalized, from: RouteLocationNormalized) => void,
  ): () => void {
    this.afterEachGuards.push(hook)
    return () => {
      const index = this.afterEachGuards.indexOf(hook)
      if (index >= 0) this.afterEachGuards.splice(index, 1)
    }
  }

  resolve(to: RouteLocationRaw): RouteLocationNormalized {
    return this.resolveTarget(to, this.currentRoute.path)
  }

  async push(to: RouteLocationRaw): Promise<NavigationResult> {
    return this.navigate(to, false, false)
  }

  async replace(to: RouteLocationRaw): Promise<NavigationResult> {
    return this.navigate(to, false, true)
  }

  isReady(): Promise<void> {
    return Promise.resolve()
  }

  private async navigate(
    to: RouteLocationRaw,
    fromHistory: boolean,
    replace = false,
  ): Promise<NavigationResult> {
    const id = ++this.navigationId
    const from = this.state.currentRoute
    let target = this.resolveTarget(to, from.path)

    // redirect：在 guard 之前跟随，最多 10 层
    let redirects = 0
    while (target.redirect) {
      if (++redirects > 10) {
        throw new Error('[actview/router] redirect 次数过多，疑似循环')
      }
      target = this.resolveTarget(target.redirect, target.path)
    }

    for (const guard of this.beforeEachGuards) {
      const result = await guard(target, from)
      if (id !== this.navigationId) return { ok: false, aborted: true }
      const handled = this.handleGuardResult(result)
      if (handled === 'abort') {
        if (fromHistory) this.history.replace(from.fullPath)
        return { ok: false, aborted: true }
      }
      if (handled) {
        return this.navigate(handled, false, replace)
      }
    }

    for (const record of target.matched) {
      for (const guard of record.beforeEnter) {
        const result = await guard(target, from)
        if (id !== this.navigationId) return { ok: false, aborted: true }
        const handled = this.handleGuardResult(result)
        if (handled === 'abort') {
          if (fromHistory) this.history.replace(from.fullPath)
          return { ok: false, aborted: true }
        }
        if (handled) {
          return this.navigate(handled, false, replace)
        }
      }
    }

    if (id !== this.navigationId) return { ok: false, aborted: true }

    const shouldReplace =
      replace ||
      (typeof to === 'object' && to !== null && 'replace' in to && !!to.replace)

    this.state.currentRoute = target
    if (!fromHistory) {
      if (shouldReplace) this.history.replace(target.fullPath)
      else this.history.push(target.fullPath)
    }

    if (this.options.scrollBehavior && typeof window !== 'undefined') {
      const position = this.options.scrollBehavior(target, from, null)
      if (position) window.scrollTo(position.left, position.top)
    }

    for (const hook of this.afterEachGuards) hook(target, from)
    return { ok: true }
  }

  private handleGuardResult(
    result: NavigationGuardResult,
  ): 'abort' | RouteLocationRaw | null {
    if (result === false) return 'abort'
    if (result === true || result == null) return null
    return result
  }

  private resolveTarget(
    to: RouteLocationRaw,
    currentPath: string,
  ): RouteLocationNormalized {
    let path: string
    let params: Record<string, string> = {}
    let query: Record<string, string | string[]> = {}
    let hash = ''
    let name: string | undefined

    if (typeof to === 'string') {
      const parsed = parseLocationString(to)
      path = parsed.path
      query = parsed.query
      hash = parsed.hash
    } else if (to.name) {
      const record = this.matcher.nameMap.get(to.name)
      if (!record) {
        throw new Error(`[actview/router] 未找到命名路由 "${to.name}"`)
      }
      const rawParams = to.params ?? {}
      const normalized: Record<string, string> = {}
      for (const [key, value] of Object.entries(rawParams)) {
        normalized[key] = String(Array.isArray(value) ? value[0] : value)
      }
      path = fillNamedPath(this.matcher, to.name, rawParams)
      params = normalized
      query = normalizeQuery(to.query)
      hash = normalizeHash(to.hash)
      name = to.name
    } else {
      path = to.path ?? '/'
      params = normalizeParams(to.params)
      query = normalizeQuery(to.query)
      hash = normalizeHash(to.hash)
    }

    path = resolvePath(path, currentPath)
    const matched = this.matcher.match(path)
    const mergedParams = { ...matched.params, ...params }
    const routeRecords = matched.matched
    const last = routeRecords[routeRecords.length - 1]
    const mergedMeta: Record<string, any> = {}
    for (const record of routeRecords) Object.assign(mergedMeta, record.meta)
    const normalizedPath = normalizePath(path)
    const fullPath =
      normalizedPath +
      stringifyQuery(query) +
      hash

    return {
      path: normalizedPath,
      fullPath,
      name: last?.name ?? name,
      params: mergedParams,
      query,
      hash,
      matched: routeRecords,
      meta: mergedMeta,
      redirect: last?.redirect,
    }
  }

  private resolveInitial(): RouteLocationNormalized {
    let target = this.resolveTarget(this.history.location(), '/')
    let redirects = 0
    while (target.redirect) {
      if (++redirects > 10) {
        throw new Error('[actview/router] 初始 redirect 次数过多')
      }
      target = this.resolveTarget(target.redirect, target.path)
    }
    return target
  }
}

export function createRouter(options: RouterOptions): Router {
  return new Router(options)
}

function resolvePath(path: string, currentPath: string): string {
  if (!path) return currentPath
  if (path.startsWith('/')) return normalizePath(path)
  const base = currentPath.endsWith('/') ? currentPath : `${currentPath}/`
  return normalizePath(`${base}${path}`)
}

function normalizeQuery(
  query: Record<
    string,
    string | number | boolean | null | undefined | Array<string | number>
  > | undefined,
): Record<string, string | string[]> {
  if (!query) return {}
  const normalized: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    normalized[key] = Array.isArray(value)
      ? value.map(String)
      : String(value)
  }
  return normalized
}

function normalizeParams(
  params: import('./types').RouteParams | undefined,
): Record<string, string> {
  if (!params) return {}
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    normalized[key] = String(Array.isArray(value) ? value[0] : value)
  }
  return normalized
}

function normalizeHash(hash: string | undefined): string {
  if (!hash) return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

export type { RouteRecordRaw }
