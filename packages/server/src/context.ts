// ============================================================
// @actview/server — SSR context / head / state
// ============================================================

import { getCurrentInstance } from '@actview/core'

export interface SSRContext {
  /** 收集 head 片段（title/meta/link 等字符串） */
  head: string[]
  /** 收集初始数据；由 SSR 入口序列化给客户端 */
  state: Record<string, unknown>
}

export function createSSRContext(): SSRContext {
  return { head: [], state: {} }
}

/**
 * 在组件 @Setup 中获取当前 SSR context；客户端 / 非 SSR 返回 null。
 */
export function useSSRContext(): SSRContext | null {
  const instance = getCurrentInstance()
  if (!instance) return null
  return (
    (instance.appContext as unknown as { __ssrContext?: SSRContext })
      .__ssrContext ?? null
  )
}
