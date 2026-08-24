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
export { computed } from './computed'
export type { ComputedRef, WritableComputedRef, ComputedOptions } from './computed'
export { ref, shallowRef, triggerRef, isRef, unref, unrefs, toValue, toRef, toRefs, rawRef } from './ref'
export type { Ref } from './ref'
export { watch, watchEffect, onWatcherCleanup } from './watch'
export type { WatchSource, WatchOptions, WatchCleanup } from './watch'

export * from './reactive-system'
export * from './effectScope'
