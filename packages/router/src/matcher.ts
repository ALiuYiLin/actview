// ============================================================
// @actview/router — path matcher
// ============================================================

import { isComponent, lazy } from '@actview/core'
import type {
  RouteComponent,
  RouteLocationRawObject,
  RouteRecord,
  RouteRecordRaw,
} from './types'

export function normalizePath(path: string): string {
  if (!path) return '/'
  let normalized = path.startsWith('/') ? path : `/${path}`
  normalized = normalized.replace(/\/+/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function joinPaths(parent: string, child: string): string {
  if (child.startsWith('/')) return normalizePath(child)
  if (!child) return normalizePath(parent || '/')
  return normalizePath(
    `${parent.endsWith('/') ? parent.slice(0, -1) : parent}/${child}`,
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compilePath(path: string): {
  regex: RegExp
  keys: string[]
  score: number
} {
  const normalized = normalizePath(path)
  if (normalized === '/') {
    return { regex: /^\/$/, keys: [], score: 1 }
  }

  const keys: string[] = []
  let score = 0
  const segments = normalized.split('/').filter(Boolean)
  let pattern = ''
  for (const segment of segments) {
    if (segment === '*' || segment.startsWith(':')) {
      const key = segment === '*' ? 'pathMatch' : segment.slice(1)
      keys.push(key)
      pattern += segment === '*' ? '/(.*)' : '/([^/]+)'
      score += segment === '*' ? 1 : 5
    } else {
      pattern += `/${escapeRegExp(segment)}`
      score += 10
    }
  }

  return {
    regex: new RegExp(`^${pattern || '/'}/?$`),
    keys,
    score: score * 100 + segments.length,
  }
}

function resolveComponent(
  component: RouteComponent | undefined,
): RouteRecord['component'] {
  if (!component) return undefined
  if (isComponent(component)) return component
  return lazy(component as () => Promise<any>)
}

export interface Matcher {
  records: RouteRecord[]
  nameMap: Map<string, RouteRecord>
  match(path: string): {
    matched: RouteRecord[]
    params: Record<string, string>
  }
  fillPath(record: RouteRecord, params: Record<string, string>): string
}

export function createMatcher(routes: RouteRecordRaw[]): Matcher {
  const records: RouteRecord[] = []
  const nameMap = new Map<string, RouteRecord>()

  const add = (
    raw: RouteRecordRaw,
    parentPath: string,
    chain: RouteRecord[],
    parent: RouteRecord | null,
  ): void => {
    const path = joinPaths(parentPath, raw.path)
    const { regex, keys, score } = compilePath(path)
    const record: RouteRecord = {
      path,
      name: raw.name,
      component: resolveComponent(raw.component),
      redirect: raw.redirect,
      children: [],
      parent,
      matched: [],
      meta: raw.meta ?? {},
      props: raw.props,
      beforeEnter: raw.beforeEnter
        ? Array.isArray(raw.beforeEnter)
          ? raw.beforeEnter
          : [raw.beforeEnter]
        : [],
      regex,
      keys,
      score,
    }
    record.matched = [...chain, record]
    records.push(record)
    if (parent) parent.children.push(record)
    if (record.name) {
      if (nameMap.has(record.name)) {
        throw new Error(`[actview/router] 重复的路由 name：${record.name}`)
      }
      nameMap.set(record.name, record)
    }

    for (const child of raw.children ?? []) {
      add(child, path, record.matched, record)
    }
  }

  for (const route of routes) add(route, '/', [], null)

  // 高分优先：静态段 > 参数 > 通配；分数相同则路径更长者优先。
  records.sort((a, b) => b.score - a.score || b.path.length - a.path.length)

  return {
    records,
    nameMap,
    match(path) {
      const normalized = normalizePath(path)
      for (const record of records) {
        const result = record.regex.exec(normalized)
        if (!result) continue
        const params: Record<string, string> = {}
        record.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(result[index + 1] ?? '')
        })
        return { matched: record.matched, params }
      }
      return { matched: [], params: {} }
    },
    fillPath(record, params) {
      let keyIndex = 0
      const path = record.path
        .split('/')
        .map((segment) => {
          if (segment === '*' || segment.startsWith(':')) {
            const key = record.keys[keyIndex++]
            const value = params[key]
            if (value == null) {
              throw new Error(
                `[actview/router] 路由 "${record.path}" 缺少参数 "${key}"`,
              )
            }
            return encodeURIComponent(String(value))
          }
          return segment
        })
        .join('/')
      return normalizePath(path)
    },
  }
}

/** 从 URL 中提取 query / hash / path */
export function parseLocationString(raw: string): {
  path: string
  query: Record<string, string | string[]>
  hash: string
  search: string
} {
  let rest = raw || '/'
  let hash = ''
  const hashIndex = rest.indexOf('#')
  if (hashIndex >= 0) {
    hash = rest.slice(hashIndex)
    rest = rest.slice(0, hashIndex)
  }
  let search = ''
  const queryIndex = rest.indexOf('?')
  if (queryIndex >= 0) {
    search = rest.slice(queryIndex + 1)
    rest = rest.slice(0, queryIndex)
  }
  return {
    path: rest || '/',
    query: parseQuery(search),
    hash,
    search,
  }
}

export function parseQuery(search: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  if (!search) return query
  const params = new URLSearchParams(search)
  for (const [key, value] of params) {
    const existing = query[key]
    if (existing === undefined) query[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else query[key] = [existing, value]
  }
  return query
}

export function stringifyQuery(
  query: Record<string, string | number | boolean | null | undefined | string[]>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === false) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else {
      params.append(key, String(value))
    }
  }
  const result = params.toString()
  return result ? `?${result}` : ''
}

/** 命名路由填充路径 */
export function fillNamedPath(
  matcher: Matcher,
  name: string,
  params: import('./types').RouteParams,
): string {
  const record = matcher.nameMap.get(name)
  if (!record) throw new Error(`[actview/router] 未找到命名路由 "${name}"`)
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    normalized[key] = String(Array.isArray(value) ? value[0] : value)
  }
  return matcher.fillPath(record, normalized)
}

export type ResolvedTarget = Pick<
  RouteLocationRawObject,
  'path' | 'name' | 'params' | 'query' | 'hash'
>
