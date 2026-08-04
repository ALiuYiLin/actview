// ============================================================
// 路由匹配 — path 字符串 =》 路由记录
//   支持静态段与动态段 :param（如 /user/:id）
// ============================================================

export interface RouteRecord {
  path: string
  component: any
  name?: string
}

export interface RouteRecordNormalized {
  record: RouteRecord
  regex: RegExp
  keys: string[]
}

export interface MatchedRoute {
  record: RouteRecord
  path: string
  params: Record<string, string>
}

/** 把路由记录编译为正则，支持 :param 动态段 */
function normalizeRecord(record: RouteRecord): RouteRecordNormalized {
  const keys: string[] = []
  const regexSource = record.path
    .replace(/:[^/]+/g, (m) => {
      keys.push(m.slice(1))
      return '([^/]+)'
    })
    .replace(/\//g, '\\/')
  return {
    record,
    regex: new RegExp(`^${regexSource}/?$`),
    keys,
  }
}

export function createMatcher(routes: RouteRecord[]) {
  const normalized = routes.map(normalizeRecord)

  function match(path: string): MatchedRoute | null {
    for (const item of normalized) {
      const m = item.regex.exec(path)
      if (m) {
        const params: Record<string, string> = {}
        item.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(m[i + 1])
        })
        return { record: item.record, path, params }
      }
    }
    return null
  }

  return { match }
}
