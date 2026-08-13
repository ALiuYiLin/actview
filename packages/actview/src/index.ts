// ============================================================
// actview — 框架统一入口
//   使用：import { createApp, reactive } from 'actview'
// ============================================================

export {
  createApp,
  defineComponent,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  nextTick,
  computed,
  ref,
  shallowRef,
  triggerRef,
  isRef,
  unref,
  toValue,
  toRef,
  toRefs,
  watch,
  watchEffect,
  onWatcherCleanup,
  effectScope,
  onScopeDispose,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  provide,
  useInjects,
  renderToString,
  Teleport,
  Transition,
  KeepAlive,
  ErrorBoundary,
  Suspense,
  lazy,
  getCurrentScope
} from '@actview/core'

export type { App, SetupContext, ComponentOptions } from '@actview/core'
