// ============================================================
// 最简 JSX 工厂
// jsx(type, config, key) → VNode 对象
// ============================================================

export const REACT_ELEMENT_TYPE = Symbol.for('react.element')
export const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment')

import type { VNode, VNodeChildren, ComponentType } from './types.js'

/** 创建 VNode（返回 any：运行时附加字段 __patchFlag/__memoValue 等由编译产物/扩展写入） */
function createVNode(type: any, key: any, props: any): any {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref: null,
    props
  }
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

/** jsx / jsxs / jsxDEV 统一逻辑：分离 key，生成 VNode */
function jsxImpl(type: any, config: any, maybeKey?: any) {
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

  // v-memo 特殊键：esbuild automatic 产物中 v-memo 是 props 键（render 时已求值，
  // 响应式追踪 ✓）→ 提取为 __memoValue（不进 props、不透传），patch 时短路整棵子树
  let memoValue: any
  if (props && props['v-memo'] !== undefined) {
    memoValue = props['v-memo']
    delete props['v-memo']
  }

  const vnode = createVNode(type, key, props)
  if (memoValue !== undefined) {
    vnode.__memoDeps = () => memoValue // 短路判断标记（值已求值）
    vnode.__memoValue = memoValue
  }
  return vnode
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
