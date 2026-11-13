// ============================================================
// @actview/router — history
// ============================================================

export interface RouterHistory {
  /** 当前 location（不含 base） */
  location(): string
  push(to: string): void
  replace(to: string): void
  /** 监听 popstate / hashchange；返回解除函数 */
  listen(cb: (location: string) => void): () => void
}

function normalizeBase(base: string): string {
  if (!base) return ''
  const normalized = base.startsWith('/') ? base : `/${base}`
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

function stripBase(pathname: string, base: string): string {
  if (!base) return pathname
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length)
  return pathname
}

/** HTML5 history；base 例如 '/app' */
export function createWebHistory(base = ''): RouterHistory {
  if (typeof window === 'undefined') {
    throw new Error('[actview/router] createWebHistory 需要浏览器环境')
  }
  const normalizedBase = normalizeBase(base)

  return {
    location() {
      return stripBase(
        window.location.pathname + window.location.search + window.location.hash,
        normalizedBase,
      )
    },
    push(to) {
      window.history.pushState(null, '', `${normalizedBase}${to}`)
    },
    replace(to) {
      window.history.replaceState(null, '', `${normalizedBase}${to}`)
    },
    listen(cb) {
      const handler = () => cb(this.location())
      window.addEventListener('popstate', handler)
      return () => window.removeEventListener('popstate', handler)
    },
  }
}

/** hash history；location 返回 # 后的内容 */
export function createWebHashHistory(): RouterHistory {
  if (typeof window === 'undefined') {
    throw new Error('[actview/router] createWebHashHistory 需要浏览器环境')
  }

  return {
    location() {
      const hash = window.location.hash.slice(1)
      return hash || '/'
    },
    push(to) {
      window.history.pushState(null, '', `#${to}`)
    },
    replace(to) {
      window.history.replaceState(null, '', `#${to}`)
    },
    listen(cb) {
      const handler = () => cb(this.location())
      window.addEventListener('popstate', handler)
      return () => window.removeEventListener('popstate', handler)
    },
  }
}

/** 内存 history：测试 / SSR / 非浏览器环境 */
export function createMemoryHistory(initialLocation = '/'): RouterHistory {
  let current = initialLocation
  const listeners = new Set<(location: string) => void>()

  return {
    location: () => current,
    push(to) {
      current = to
    },
    replace(to) {
      current = to
    },
    listen(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}
