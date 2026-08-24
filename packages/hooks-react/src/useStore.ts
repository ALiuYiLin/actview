// ============================================================
// useSyncExternalStore / useId / useDebugValue / useTransition / useDeferredValue
//
// useSyncExternalStore(subscribe, getSnapshot) → Ref<T>：
//   订阅外部 store，变化时把 getSnapshot() 写入 ref；组件卸载自动退订。
//
// useId：转发 actview 原生 useId（返回 'actview-id-...' 稳定 id）。
// useDebugValue：no-op（ActView 无 devtools 标签）。
//
// useTransition / useDeferredValue：React 并发特性降级——
//   - useTransition：无并发调度，startTransition 同步执行，pending 恒 false
//   - useDeferredValue：无延迟渲染，computed 直接透传（值若为 ref 保持响应式）
// ============================================================

import {
  computed,
  ref,
  onUnmounted,
  toValue,
  useId as avUseId,
  type Ref,
  type ComputedRef,
} from '@actview/core'

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): Ref<T> {
  const stateRef = ref<T>(getSnapshot())
  const unsubscribe = subscribe(() => {
    stateRef.value = getSnapshot()
  })
  onUnmounted(() => {
    unsubscribe?.()
  })
  return stateRef
}

export function useId(): string {
  return avUseId()
}

export function useDebugValue<T>(value: T, format?: (value: T) => unknown): void {
  // no-op：ActView 无 devtools 标签（保留参数签名，迁移零改动）
  void value
  void format
}

export function useTransition(): [Ref<boolean>, (callback: () => void) => void] {
  const pending = ref(false)
  const startTransition = (callback: () => void) => {
    // ActView 无并发调度：同步执行，pending 恒 false（降级）
    callback()
  }
  return [pending, startTransition]
}

export function useDeferredValue<T>(value: T): ComputedRef<T> {
  // 无延迟渲染降级：透传（value 为 ref 时保持响应式追踪）
  return computed(() => toValue(value))
}
