// ============================================================
// @actview/core — DOM 运行时公开入口
//
// M1：createApp / mount / unmount、组件级 re-render、patch、生命周期、nextTick
// M2：keyed children diff、provide/inject、public instance proxy、
//     $forceUpdate、完整 patchProp（DOM property / SVG / 事件选项）
// ============================================================

export { createApp } from './runtime/app'
export type { App, AppPlugin, Plugin } from './runtime/app'
export type { AppConfig } from './runtime/instance'
export { nextTick } from './runtime/scheduler'
export { provide, inject } from './runtime/apiProvide'
export { Suspense } from './components/Suspense'
export { lazy } from './components/AsyncComponent'
export type { LazyOptions } from './components/AsyncComponent'
export { ErrorBoundary } from './components/ErrorBoundary'
export { Teleport } from './components/Teleport'
export { Transition } from './components/Transition'
export { TransitionGroup, Dynamic } from './components/TransitionGroup'
export { KeepAlive } from './components/KeepAlive'
export {
  ActViewComponent,
  Activated,
  BeforeMount,
  BeforeUnmount,
  BeforeUpdate,
  Component,
  Computed,
  Deactivated,
  Inject,
  Model,
  Mounted,
  Named,
  Prop,
  Provide,
  Reactive,
  Ref,
  Scope,
  Setup,
  Unmounted,
  Updated,
  UseModel,
  Watch,
  getComponentMeta,
} from './decorator'
export type {
  ComponentMeta,
  ComponentOptions,
  InjectMeta,
  LifecycleName,
  ModelRef,
  ModelScope,
  ModelToken,
  PropOptions,
  ProvideMeta,
  ReactiveOptions,
  RefOptions,
  WatchMeta,
  WatchSource,
} from './decorator'
export { setDevtoolsHook, getDevtoolsHook } from './runtime/devtools'
export type {
  DevtoolsAppInfo,
  DevtoolsComponentInfo,
  DevtoolsHook,
  DevtoolsPerformanceEvent,
  DevtoolsReactiveEvent,
} from './runtime/devtools'
export {
  getCurrentInstance,
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onErrorCaptured,
} from './lifecycle'

// 组件 / 元素基础 API（运行时 + 类型）
export {
  Fragment,
  createElement,
  isClassComponent,
  isComponent,
  isValidElement,
} from './internal'

export type {
  BuiltinComponent,
  ClassComponent,
  ComponentProps,
  Element,
  ElementChild,
  ElementChildren,
  ElementType,
  RenderFunction,
} from './internal'

export type { ComponentPublicInstance } from './runtime/instance'
