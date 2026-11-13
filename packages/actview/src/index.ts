// ============================================================
// actview — 面向用户的项目聚合入口（薄壳）
//
// 只导出用户写应用需要的 API：
//   - createApp / App
//   - ActViewComponent + 全部类组件装饰器
//   - 内置组件 / lazy
//
// 不导出：
//   - @actview/reactivity 的 ref / reactive / effect / computed / watch
//     （这些是运行时/装饰器内部实现）
//   - provide/inject 函数、getCurrentInstance、onXxx 注册函数等运行时内部 API
//   - @actview/core/internal（VNode / ComponentInternalInstance 等）
// ============================================================

export { createApp } from '@actview/core'
export type { App } from '@actview/core'

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
  Prop,
  Provide,
  Reactive,
  Ref,
  Setup,
  Unmounted,
  Updated,
  UseModel,
  Watch,
} from '@actview/core'

export {
  ErrorBoundary,
  KeepAlive,
  Suspense,
  Teleport,
  Transition,
  lazy,
} from '@actview/core'

export type {
  BuiltinComponent,
  ClassComponent,
  ComponentProps,
  Element,
  ElementChild,
  ElementChildren,
  ElementType,
  ModelToken,
} from '@actview/core'
