// ============================================================
// JSX automatic runtime（公开作者层的运行时入口）
//
// tsconfig: { "jsx": "react-jsx", "jsxImportSource": "@actview/jsx" }
// JSX 表达式编译为 jsx(type, props, key) / jsxs(...) / jsxDEV(...)。
//
// 约定：
//   - 这里只依赖 @actview/core 的**公开**工厂（createElement → Element），
//     不 touch VNode 内部类型；
//   - 返回值类型是公开 Element（运行时对象由渲染器内部持有结构）；
//   - key 从 props 提升为元素 key（与自动运行时约定一致）；
//   - 顶层 ref 值解包（MaybeRef 属性形态）由后续 runtime 统一处理。
// ============================================================

import { createElement, Fragment } from '@actview/core'
import type { Element, ElementType } from '@actview/core'

// 副作用：把全局 JSX 命名空间（IntrinsicElements 等）挂进本模块的消费方。
import './jsx'

/** 自动运行时 props 规范化：key 从 props 提升，避免 key 进入组件 props */
function normalizeConfig(config: Record<string, any> | null): {
  props: Record<string, any> | null
  key: string | number | null
} {
  if (!config) return { props: null, key: null }
  if (!('key' in config)) return { props: config, key: null }
  const { key, ...rest } = config
  return { props: rest, key: key ?? null }
}

function jsxImpl(
  type: ElementType,
  config: Record<string, any> | null,
  maybeKey?: string | number | null,
): Element {
  const normalized = normalizeConfig(config)
  return createElement(type, normalized.props, maybeKey ?? normalized.key)
}

/** automatic runtime 单子节点入口 */
export const jsx = jsxImpl
/** automatic runtime 多子节点入口 */
export const jsxs = jsxImpl

/** development runtime：额外参数（isStaticChildren / source / self）不影响产物 */
export function jsxDEV(
  type: ElementType,
  config: Record<string, any> | null,
  maybeKey?: string | number | null,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): Element {
  return jsxImpl(type, config, maybeKey)
}

export { Fragment }
