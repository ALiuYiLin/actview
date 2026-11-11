// ============================================================
// @actview/core — DOM 运行时公开入口
//
// 已实现（M1）：
//   - createApp / mount / unmount
//   - 组件级 re-render（setup 一次 + render effect + 微任务批处理）
//   - patch：text / element / Fragment / 组件，props/class/style/事件
//   - 生命周期：onBeforeMount / onMounted / onBeforeUpdate / onUpdated /
//     onBeforeUnmount / onUnmounted
//   - nextTick
//
// 组件定义 / 元素工厂从 @actview/runtime-core 再导出，方便应用侧单入口使用。
// ============================================================

export { createApp } from './app'
export { nextTick } from './scheduler'
export {
  getCurrentInstance,
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from './lifecycle'

// 组件 / 元素基础 API（运行时 + 类型）
export {
  Fragment,
  createElement,
  defineComponent,
  isComponent,
  isValidElement,
} from '@actview/runtime-core'

export type {
  ComponentFunction,
  ComponentProps,
  ComponentTag,
  Element,
  ElementChild,
  ElementChildren,
  ElementType,
  RenderFunction,
  SetupContext,
} from '@actview/runtime-core'
