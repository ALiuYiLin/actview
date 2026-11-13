// ============================================================
// @actview/jsx — JSX 作者层公开入口
//
// 本包只负责「写 TSX 时用户看到的那一层」：
//   - 全局 JSX 命名空间（Element / ElementType / IntrinsicElements）
//   - 公开元素 / 组件契约（从 runtime-core 再导出）
//   - DOM / SVG 属性类型
//   - JSX automatic runtime（jsx / jsxs / jsxDEV / Fragment）
//
// DOM 渲染器（createApp / patch / 生命周期）属于 @actview/core，后续接入。
// 内部渲染器类型一律走 @actview/core/internal，不在此导出。
// ============================================================

// 副作用：加载全局 JSX 命名空间（IntrinsicElements / Element / ElementType）
import './jsx'

export type {
  BuiltinComponent,
  ClassComponent,
  Element,
  ElementType,
  ComponentProps,
  ElementChild,
  ElementChildren,
  RenderFunction,
} from '@actview/core'

export type * from './jsx/attrs'

export { createElement, isValidElement, Fragment } from '@actview/core'
export { jsx, jsxs, jsxDEV } from './jsx-runtime'
