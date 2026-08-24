// ============================================================
// useMemo / useCallback — 记忆化
//
// useMemo(fn) → computed(fn)：返回 ComputedRef，JSX 里自动解包；
//   deps 数组忽略——响应式自动追踪（不需要手写依赖，比 React 更省心）。
//
// useCallback(fn) → 原样返回 fn：setup 只执行一次，函数闭包天然稳定，
//   React useCallback 想解决的"每次渲染重建函数引用"问题在 ActView
//   根本不存在，所以是 no-op 包装（保留 React 签名，迁移零改动）。
// ============================================================

import { computed, type ComputedRef } from '@actview/core'

export function useMemo<T>(factory: () => T, _deps?: unknown[]): ComputedRef<T> {
  return computed(factory)
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  _deps?: unknown[]
): T {
  return callback
}
