// ============================================================
// @actview/runtime-core — 公开类型入口（public）
//
// 只导出跨层稳定的类型与工厂：
//   - Element / ElementType / BuiltinComponent / ClassComponent /
//     ComponentProps / ElementChild / ElementChildren
//   - RenderFunction
//   - createElement / isValidElement / Fragment
//   - isClassComponent / isComponent（组件 = @Component class + 标记）
// ============================================================

export type {
  Element,
  ElementType,
  BuiltinComponent,
  ClassComponent,
  ComponentProps,
  ElementChild,
  ElementChildren,
} from './element'

export type { RenderFunction } from './component'

export {
  CLASS_COMPONENT_MARKER,
  isClassComponent,
  isComponent,
} from './component'
export type { ClassComponentCtor } from './component'
export { Fragment, createElement, isValidElement } from './factory'
