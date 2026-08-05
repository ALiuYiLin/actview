// ============================================================
// history 抽象 — 路由位置与导航事件的来源
//   createMemoryHistory  内存模式（不依赖浏览器，可测试 / SSR）
//   createWebHistory     浏览器 History API 模式（pushState + popstate）
// ============================================================

export interface RouterHistory {
  /** 当前完整路径（含 query） */
  readonly location: string
  /** 订阅导航变化，返回取消订阅函数 */
  listen(cb: (to: string) => void): () => void
  push(to: string): void
  replace(to: string): void
  /** 相对当前前进/后退 delta 步 */
  go(delta: number): void
}

// ------------------------------------------------------------
// 内存模式
// ------------------------------------------------------------

export function createMemoryHistory(initial: string = '/'): RouterHistory {
  let index = 0
  const stack: string[] = [initial]
  const listeners = new Set<(to: string) => void>()

  const emit = () => {
    const to = stack[index]
    listeners.forEach((cb) => cb(to))
  }

  return {
    get location() {
      return stack[index]
    },
    listen(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    push(to) {
      // 前进时丢弃当前之后的记录
      stack.splice(index + 1)
      stack.push(to)
      index++
      emit()
    },
    replace(to) {
      stack[index] = to
      emit()
    },
    go(delta) {
      const target = Math.min(Math.max(index + delta, 0), stack.length - 1)
      if (target === index) return
      index = target
      emit()
    }
  }
}

// ------------------------------------------------------------
// 浏览器 History API 模式
// ------------------------------------------------------------

export function createWebHistory(base: string = ''): RouterHistory {
  const listeners = new Set<(to: string) => void>()
  const notify = (to: string) => listeners.forEach((cb) => cb(to))
  const emit = () => {
    notify(window.location.pathname + window.location.search)
  }
  const onPopState = () => emit()

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState)
  }

  return {
    get location() {
      return window.location.pathname + window.location.search
    },
    listen(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    push(to) {
      window.history.pushState(null, '', base + to)
      // pushState 不触发 popstate，需手动通知目标路径
      notify(base + to)
    },
    replace(to) {
      window.history.replaceState(null, '', base + to)
      notify(base + to)
    },
    go(delta) {
      // 由浏览器触发 popstate =》 emit（读取 location）
      window.history.go(delta)
    }
  }
}
