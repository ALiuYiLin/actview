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
  markRaw,
  nextTick,
  computed,
  ref,
  isRef,
  unref,
  toRef,
  toRefs,
  watch,
  watchEffect,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  renderToString,
  Teleport,
  Transition,
  KeepAlive,
  ErrorBoundary,
  Suspense,
  lazy,
  getCurrentScope,
} from '@actview/core'

export type { App } from '@actview/core'
