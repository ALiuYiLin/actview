// ============================================================
// @actview/core — server-only internal exports
//
// 供 @actview/server 复用组件实例 / setup / render 逻辑；
// 不进入 core 公开入口。
// ============================================================

export {
  Fragment,
  Text,
  createTextVNode,
  createVNode,
  isVNode,
  type VNode,
} from './runtime/vnode'
export {
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
} from './runtime/component'
export { hydrate } from './runtime/patch'
export { isComponent } from './types/component'
export type { App } from './runtime/app'
export type {
  AppContext,
  ComponentInternalInstance,
} from './runtime/instance'
