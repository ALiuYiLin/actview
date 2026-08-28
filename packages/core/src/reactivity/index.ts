import {
  reactive,
  readonly as readonlyImpl,
  shallowReadonly as shallowReadonlyImpl,
  shallowReactive,
} from './reactive'
import { computed } from './computed'
import { ref, shallowRef, toRef, toRefs } from './ref'
import { watch, watchEffect } from './watch'

export {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow
} from './reactive'
export type { Reactive, ShallowReactive, ShallowReadonly } from './reactive'
export { computed } from './computed'
export type { ComputedRef, WritableComputedRef, ComputedOptions } from './computed'
export { ref, shallowRef, triggerRef, isRef, unref, unrefs, toValue, toRef, toRefs, rawRef } from './ref'
export type { Ref } from './ref'
export { watch, watchEffect, onWatcherCleanup } from './watch'
export type { WatchSource, WatchOptions, WatchCleanup } from './watch'

export * from './reactive-system'
export * from './effectScope'

// ============================================================
// 工厂函数类型（typeof X）——把「创建响应式对象」的能力作为一等公民传递
//   用途:高阶封装的形参（注入工厂/测试替身）、库作者把工厂作为 API 返回。
//   示例:function useStateLike(create: RefFactory<number>) { const n = create(0); … }
// 保留完整重载签名（typeof X 天然携带）,泛型调用处照常推导。
// readonly/shallowReadonly 因与 TS 关键字同名,以别名导入后取 typeof。
// ============================================================
export type RefFactory = typeof ref
export type ShallowRefFactory = typeof shallowRef
export type ReactiveFactory = typeof reactive
export type ShallowReactiveFactory = typeof shallowReactive
export type ReadonlyFactory = typeof readonlyImpl
export type ShallowReadonlyFactory = typeof shallowReadonlyImpl
export type ComputedFactory = typeof computed
export type ToRefFactory = typeof toRef
export type ToRefsFactory = typeof toRefs
export type WatchFactory = typeof watch
export type WatchEffectFactory = typeof watchEffect
