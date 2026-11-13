// ============================================================
// ./internal — 内部类型入口（@actview/core）
//
// 供渲染器 / 测试使用：
//   - VNode / VNodeTypes / VNodeChild(ren) / createVNode / isVNode / Fragment
//   - ClassComponentCtor / ComponentInternalInstance / RenderFunction
//   - isClassComponent / isComponent / CLASS_COMPONENT_MARKER（组件标记契约）
//   - 公开契约类型（Element 等）按需再导出，方便内部模块单点导入
//
// 该子路径**不进入** publishConfig 的公开 exports（workspace 内使用）；
// 外部消费方只能看到公开入口。
// ============================================================

export * from './runtime/vnode'
export * from './runtime/vnodeFactory'
export * from './types/component'

export type {
  Element,
  ElementType,
  BuiltinComponent,
  ClassComponent,
  ComponentProps,
  ElementChild,
  ElementChildren,
} from './types/element'
