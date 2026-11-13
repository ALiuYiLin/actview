// ============================================================
// @actview/core — lazy / 异步组件
//
//   const Comp = lazy(() => import('./Comp'), {
//     loading: () => h('span', null, 'loading'),
//     error: (err) => h('span', null, err.message),
//     timeout: 5000,
//     retry: 2,
//     retryDelay: 300,
//   })
//
// 设计：
//   - 本地状态（loading / error）可独立于 Suspense 使用；
//   - 在 Suspense 内会 register/resolve，继续显示边界 fallback；
//   - loader 成功结果按 lazy() 闭包缓存；
//   - 失败/超时可按 retry 次数重试，最终进入 error 状态。
// ============================================================

import type { ClassComponentCtor } from '../internal'
import { createVNode } from '../internal'
import type { ElementChild } from '../types/element'
import {
  ActViewComponent,
  Component,
  Ref,
  Setup,
  Unmounted,
} from '../decorator'
import { getCurrentSuspense, type SuspenseContext } from './Suspense'

/** loading / error 可传节点或返回节点的函数（需要组件时用 () => <Loading />） */
export type LazyFallback =
  | ElementChild
  | ((arg?: any) => ElementChild)

export interface LazyOptions {
  /** 加载态；默认不渲染（null） */
  loading?: LazyFallback
  /** 失败态；可传 `(err) => node` */
  error?: LazyFallback
  /** 单次尝试超时（ms）；0 / 不传 = 不限制 */
  timeout?: number
  /** 失败后的重试次数（默认 0） */
  retry?: number
  /** 重试间隔（ms，默认 0） */
  retryDelay?: number
  /** 每次尝试失败回调（重试中会多次调用） */
  onError?: (err: unknown) => void
}

/**
 * 异步组件：loader 返回 Promise（模块取 default ?? mod）。
 *
 * - 无 Suspense 时：loading 态渲染 options.loading 或 null；
 * - 在 Suspense 内：同时 register/resolve 边界 fallback；
 * - 成功结果缓存，多次挂载只加载一次（失败后可重试）。
 */
export function lazy(
  loader: () => Promise<any>,
  options: LazyOptions = {},
): ClassComponentCtor {
  let loaded: any = null
  let loading: Promise<any> | null = null

  const load = (): Promise<any> => {
    if (loaded) return Promise.resolve(loaded)
    if (!loading) {
      loading = loadWithRetry(loader, options)
        .then((mod) => {
          loaded = (mod as { default?: unknown } | null)?.default ?? mod
          return loaded
        })
        .catch((err) => {
          // 失败不缓存，下一次挂载可以重新尝试。
          loading = null
          throw err
        })
    }
    return loading
  }

  @Component({ name: 'Lazy' })
  class Lazy extends ActViewComponent<Record<string, any>> {
    @Ref
    status: 'loading' | 'success' | 'error' = 'loading'

    @Ref
    resolved: any = null

    @Ref
    error: unknown = null

    private disposed = false
    private suspense: SuspenseContext | null = null

    @Setup
    setup(): void {
      const suspense = getCurrentSuspense()
      this.suspense = suspense
      suspense?.register()

      void load().then(
        (component) => {
          if (this.disposed) return
          this.resolved = component
          this.status = 'success'
          suspense?.resolve()
        },
        (err) => {
          if (this.disposed) return
          this.error = err
          this.status = 'error'
          suspense?.resolve()
        },
      )
    }

    @Unmounted
    unmounted(): void {
      this.disposed = true
      // 避免组件已卸载但 Suspense 一直 pending。
      this.suspense?.resolve()
    }

    render() {
      if (this.status === 'success') {
        return createVNode(this.resolved, { ...this.$props })
      }
      if (this.status === 'error') {
        return renderFallback(options.error, this.error)
      }
      return renderFallback(options.loading)
    }
  }

  return Lazy as unknown as ClassComponentCtor
}

async function loadWithRetry(
  loader: () => Promise<any>,
  options: LazyOptions,
): Promise<any> {
  const retries = Math.max(0, Math.floor(options.retry ?? 0))
  const delay = Math.max(0, options.retryDelay ?? 0)
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(
        Promise.resolve().then(() => loader()),
        options.timeout,
      )
    } catch (err) {
      lastError = err
      options.onError?.(err)
      if (attempt < retries && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

function withTimeout<T>(promise: Promise<T>, timeout?: number): Promise<T> {
  if (!timeout || timeout <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[actview] lazy timeout after ${timeout}ms`))
    }, timeout)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function renderFallback(
  fallback: LazyFallback | undefined,
  arg?: unknown,
): ElementChild {
  if (typeof fallback === 'function') {
    return (fallback as (arg?: unknown) => ElementChild)(arg)
  }
  return fallback ?? null
}
