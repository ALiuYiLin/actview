// ============================================================
// @actview/core — 装饰器统一出口
// ============================================================

export { ActViewComponent, Component } from './component'
export { Model, Named, Scope, UseModel } from './model'
export {
  Computed,
  Inject,
  Prop,
  Provide,
  Reactive,
  Ref,
  Watch,
} from './reactive'
export {
  Activated,
  BeforeMount,
  BeforeUnmount,
  BeforeUpdate,
  Deactivated,
  Mounted,
  Setup,
  Unmounted,
  Updated,
} from './lifecycle'
export {
  createComponentMeta,
  getComponentMeta,
  mergeMeta,
  metaOf,
  ownMeta,
} from './meta'
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
} from './meta'
