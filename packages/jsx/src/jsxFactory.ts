// ============================================================
// 最简 JSX 工厂
// jsx(type, config, key) → VNode 对象
// ============================================================

export const REACT_ELEMENT_TYPE = Symbol.for('react.element')
export const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment')

import type { VNode, VNodeChildren, ComponentType } from './types.js'

/** 创建 VNode；patchFlag 为编译期动态性标记（见 @actview/babel-plugin-actview 的 JSX 编译）。
 * children（第 6 参）独立存 __children 字段——不塞进 props：
 * 静态 props 可提升为模块级常量共享，动态 children 不与共享对象混在一起。 */
function createVNode(
  type: any,
  key: any,
  props: any,
  patchFlag?: number,
  propsKeys?: readonly string[],
  children?: any,
) {
  const vnode: any = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref: null,
    props
  }
  if (patchFlag !== undefined) vnode.__patchFlag = patchFlag
  if (propsKeys) vnode.__propsKeys = propsKeys
  if (children !== undefined) vnode.__children = children
  return vnode
}

// 类型签名（JSX 检查）：
//   字符串标签 → JSX.IntrinsicElements（div → HtmlProps，input → InputProps）
//   组件（defineComponent 产物）→ PropsOf 推导 props（含事件类型）
//   Fragment（symbol）→ 仅 children
function jsxImpl<K extends keyof JSX.IntrinsicElements>(
  type: K,
  config: JSX.IntrinsicElements[K] & { children?: VNodeChildren },
  maybeKey?: any
): VNode
function jsxImpl<P>(
  type: ComponentType<P>,
  config: P & { children?: VNodeChildren },
  maybeKey?: any
): VNode
function jsxImpl(
  type: symbol,
  config: { children?: VNodeChildren },
  maybeKey?: any
): VNode

/** jsx / jsxs / jsxDEV 统一逻辑：分离 key，生成 VNode。
 * patchFlag：编译期动态性标记（1=TEXT 动态文本 children；2=PROPS 动态属性；
 * 0=props 全静态）。propsKeys：PROPS 标记下的动态属性名列表。
 * children（第 6 参）：babel 编译产物把动态 children 与静态 props 分离——
 * 静态 props 提升为模块级常量（共享、引用稳定），children 独立存 __children。
 */
function jsxImpl(
  type: any,
  config: any,
  maybeKey?: any,
  patchFlag?: number,
  propsKeys?: readonly string[],
  children?: any,
) {
  let key: any = null

  if (maybeKey !== undefined) {
    key = '' + maybeKey
  } else if (config && config.key !== undefined) {
    key = '' + config.key
  }

  let props: any
  if (config && 'key' in config) {
    props = {}
    for (const k in config) {
      if (k !== 'key') props[k] = config[k]
    }
  } else {
    props = config || {}
  }

  return createVNode(type, key, props, patchFlag, propsKeys, children)
}

// 自动 JSX 转换目标
export const jsx = jsxImpl
export const jsxs = jsxImpl
export const jsxDEV = jsxImpl

/** 经典 createElement(type, props, ...children) */
export function createElement(type: any, config: any, ...children: any[]) {
  const props = config ? { ...config } : {}
  const key = props.key ?? null
  delete props.key

  if (children.length === 1) props.children = children[0]
  else if (children.length > 1) props.children = children

  return createVNode(type, key, props)
}

/** 校验是否为 VNode */
export function isValidElement(obj: any) {
  return !!obj && obj.$$typeof === REACT_ELEMENT_TYPE
}

/** Fragment 标记 */
export const Fragment = REACT_FRAGMENT_TYPE
