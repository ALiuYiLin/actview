// ============================================================
// @actview/runtime-core — 公开类型入口（public）
//
// 只导出跨层稳定的类型与工厂：
//   - Element / ElementType / ComponentFunction / ComponentTag /
//     ComponentProps / ElementChild / ElementChildren
//   - RenderFunction / SetupContext
//   - createElement / isValidElement / Fragment
//   - defineComponent / isComponent（组件 = setup 函数本体 + 标记）
//
// 渲染器内部类型（VNode / Component / ComponentInternalInstance 等）
// 一律从 `@actview/runtime-core/internal` 导入，**不要**从本入口导出。
// ============================================================

export type {
  Element,
  ElementType,
  ComponentFunction,
  ComponentTag,
  ComponentProps,
  ElementChild,
  ElementChildren,
} from './element'

export type { RenderFunction, SetupContext } from './component'

export { defineComponent, isComponent } from './component'
export { Fragment, createElement, isValidElement } from './factory'
