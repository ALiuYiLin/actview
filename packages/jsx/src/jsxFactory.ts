// ============================================================
// 最简 JSX 工厂
// jsx(type, config, key) → VNode 对象
// ============================================================

export const REACT_ELEMENT_TYPE = Symbol.for('react.element')
export const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment')

import type {
  VNode,
  VNodeChildren,
  ComponentType,
  MaybeRefProps
} from './types.js'

// 内联 isRef（与 core reactivity/ref.ts 同一判定：__v_isRef 标记），
// jsx 包保持零依赖底座，不能 import core。
function isRef(v: any): boolean {
  return !!(v && (v as any).__v_isRef === true)
}

/**
 * props 自动解包（JSX 侧）：属性值为 ref/computedRef（带 __v_isRef 标记）时，
 * 在创建 vnode 时读取 .value，消费方（组件 setup / 原生元素 patchProps）收到的
 * 是解包后的普通值。
 *
 * 时机正确性：解包发生在 JSX 表达式求值处 = 组件 render effect 执行期间
 * （组件 setup 之后的 runEffect → effect.run()），读 ref.value 会 track 到
 * 渲染 effect → ref 变化 → 重渲染 → 新值传递（响应式 props，对齐 Vue 模板
 * 编译期 _unref 的语义）。若解包发生在 setup 阶段（pauseTracking 包裹），
 * track 被吞 → 渲染函数失去响应性。
 *
 * 排除 ref 键：ref 是模板引用语义（renderer applyRef 写 .value），不能解包。
 * key/v-memo 已在调用方提取，不会出现在 props 中。
 *
 * 惰性拷贝：props 无 ref 时返回原对象（零拷贝，React 每次渲染新建 props 的
 * 开销量级内多一次 O(n) 扫描）。
 */
function unwrapProps(props: any): any {
  if (!props) return props
  let out: any = null
  for (const k in props) {
    if (k === 'ref') continue
    const v = props[k]
    if (isRef(v)) {
      if (!out) out = { ...props }
      out[k] = v.value
    }
  }
  return out ?? props
}

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
//   config 属性经 MaybeRefProps 映射：接受 Ref 形态（运行时 unwrapProps 顶层解包）
function jsxImpl<K extends keyof JSX.IntrinsicElements>(
  type: K,
  config: MaybeRefProps<JSX.IntrinsicElements[K]> & { children?: VNodeChildren },
  maybeKey?: any
): VNode
function jsxImpl<P>(
  type: ComponentType<P>,
  config: MaybeRefProps<P> & { children?: VNodeChildren },
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

  const vnode = createVNode(type, key, unwrapProps(props))
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

  return createVNode(type, key, unwrapProps(props))
}

/** 校验是否为 VNode */
export function isValidElement(obj: any) {
  return !!obj && obj.$$typeof === REACT_ELEMENT_TYPE
}

/** Fragment 标记 */
export const Fragment = REACT_FRAGMENT_TYPE
