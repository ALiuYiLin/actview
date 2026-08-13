// ============================================================
// 路由匹配 — path 字符串 =》 匹配链（MatchedRoute[]）
//   支持静态段、动态段 :param、嵌套路由（children）、redirect、meta、beforeEnter
// ============================================================

import { markRaw } from '@actview/core'

/** 导航守卫：返回 void/true 放行；false 取消；string/{path} 重定向；Promise 异步 */
export type NavigationGuard = (
  to: any,
  from: any
) => void | boolean | string | { path: string } | Promise<any>

export interface RouteRecord {
  path: string
  component?: any
  name?: string
  redirect?: string | { path: string }
  meta?: Record<string, any>
  beforeEnter?: NavigationGuard
  children?: RouteRecord[]
}

export interface MatchedRoute {
  record: RouteRecord
  /** 完整路径（含父前缀） */
  path: string
  params: Record<string, string>
}

interface NormalizedRecord {
  record: RouteRecord
  fullPath: string
  regex: RegExp
  keys: string[]
  children: NormalizedRecord[]
}

/** 拼接父子路径：'/' + 'user' → '/user'；'/a' + '/b' → '/a/b' */
function joinPath(parent: string, child: string): string {
  const left = parent.replace(/\/+$/, '')
  const right = child.replace(/^\/+/, '')
  return (left ? left : '') + (right ? '/' + right : '') || '/'
}

/** 编译带 :param 的路径为「前缀 + 段边界」正则（嵌套路由父级前缀命中用） */
function compilePath(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = []
  const source = path
    .replace(/:[^/]+/g, (m) => {
      keys.push(m.slice(1))
      return '([^/]+)'
    })
    .replace(/\//g, '\\/')
  // lookahead (?=\/|$)：匹配到段边界（后接 / 或结束），避免 /user/1 误匹配 /user/10
  return { regex: new RegExp(`^${source}(?=\\/|$)`), keys }
}

export function createMatcher(routes: RouteRecord[]) {
  function normalize(records: RouteRecord[], basePath = ''): NormalizedRecord[] {
    const out: NormalizedRecord[] = []
    for (const record of records) {
      const fullPath = joinPath(basePath, record.path)
      const { regex, keys } = compilePath(fullPath)
      out.push({
        record: markRaw(record), // 路由记录不参与响应式代理（避免 component 被包代理）
        fullPath,
        regex,
        keys,
        children: record.children ? normalize(record.children, fullPath) : []
      })
    }
    return out
  }

  const normalized = normalize(routes)

  /** 递归匹配：返回根到叶子的完整匹配链；未命中返回 null */
  function matchPath(
    records: NormalizedRecord[],
    targetPath: string,
    baseParams: Record<string, string> = {}
  ): MatchedRoute[] | null {
    for (const nr of records) {
      const m = nr.regex.exec(targetPath)
      if (!m) continue
      const params = { ...baseParams }
      nr.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1])
      })
      const matched: MatchedRoute[] = [
        { record: nr.record, path: nr.fullPath, params }
      ]
      const rest = targetPath.slice(m[0].length)
      if (nr.children.length) {
        const child = matchPath(nr.children, targetPath, params)
        if (child) return matched.concat(child)
        // 子路由均未命中：剩余为空则父作为叶子
        if (rest === '' || rest === '/') return matched
        return null
      }
      // 无子路由：剩余必须为空（否则不匹配）
      if (rest === '' || rest === '/') return matched
      return null
    }
    return null
  }

  return { match: (path: string) => matchPath(normalized, path) }
}
