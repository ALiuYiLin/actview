// ============================================================
// @actview/core — DOM 运行时公开入口
//
// M1：createApp / mount / unmount、组件级 re-render、patch、生命周期、nextTick
// M2：keyed children diff、provide/inject、public instance proxy、
//     $forceUpdate、完整 patchProp（DOM property / SVG / 事件选项）
// ============================================================

export { createApp } from './app'
export type { App } from './app'
export { nextTick } from './scheduler'
export { provide, inject } from './apiProvide'
export { Suspense, lazy } from './suspense'
export { ErrorBoundary } from './errorBoundary'
export { Teleport } from './teleport'
export { Transition } from './transition'
export { KeepAlive } from './keepAlive'
export {
  ActViewComponent,
  Activated,
  BeforeMount,
  BeforeUnmount,
  BeforeUpdate,
  Component,
  Deactivated,
  Mounted,
  Prop,
  Ref,
  Setup,
  Unmounted,
  Updated,
  getComponentMeta,
} from './decorators'
export type {
  ComponentMeta,
  ComponentOptions,
  LifecycleName,
  PropOptions,
  RefOptions,
} from './decorators'
export { setDevtoolsHook, getDevtoolsHook } from './devtools'
export type { DevtoolsComponentInfo, DevtoolsHook } from './devtools'
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
  isComponent,
  isValidElement,
} from '@actview/runtime-core'

export type {
  BuiltinComponent,
  ClassComponent,
  ComponentProps,
  Element,
  ElementChild,
  ElementChildren,
  ElementType,
  RenderFunction,
} from '@actview/runtime-core'

export type { ComponentPublicInstance } from './instance'
