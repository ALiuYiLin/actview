// ============================================================
// VNode 类型与最小工厂（internal）
//
// VNode 是渲染器视角的元素：公开 Element 契约 + 渲染器字段。
// 只经 `@actview/runtime-core/internal` 暴露，公开入口不导出。
// 依赖方向：vnode → element（公开契约），绝不反向。
// ============================================================

import type { Element, ElementType } from './element'
import type { ComponentInternalInstance } from './component'

/** 内部 VNode 的 type 集合（= 公开 ElementType） */
export type VNodeTypes = ElementType

/** VNode key */
export type VNodeKey = string | number | null

/** 单个子节点 */
export type VNodeChild = VNode | string | number | boolean | null | undefined

/** 子节点数组（允许嵌套，渲染器展平） */
export type VNodeArrayChildren = Array<VNodeChild | VNodeArrayChildren>

/** children 类型 */
export type VNodeChildren = VNodeChild | VNodeArrayChildren

/**
 * 渲染器 VNode：public Element 的子类型。
 *
 * 公开字段（type / key / props / ref）与 Element 完全一致且 readonly；
 * 其余字段是渲染器内部状态，用户代码不应依赖。
 */
export interface VNode<Type extends VNodeTypes = VNodeTypes>
  extends Element {
  readonly type: Type
  readonly key: VNodeKey
  readonly props: Record<string, any> | null
  readonly ref: any
  /** VNode 品牌标记（isVNode 判定；公开 Element 不含） */
  readonly __v_isVNode: true
  /** 挂载后的宿主节点（渲染器写入） */
  el: unknown | null
  /** 组件 vnode 对应的实例（渲染器写入） */
  component: ComponentInternalInstance | null
  /** 子节点（渲染器按需挂载；公开层通过 props.children 读取） */
  children?: VNodeChildren
}

/** Fragment 标记（`<></>` / `<Fragment>` 的 type） */
export const Fragment: symbol = Symbol.for('actview.fragment')

/** 文本节点标记（渲染器内部：`string | number` 渲染值归一化后的 type） */
export const Text: symbol = Symbol.for('actview.text')

/** 创建文本 VNode（渲染器内部使用；props.text 保存文本内容） */
export function createTextVNode(text: string): VNode<typeof Text> {
  return {
    __v_isVNode: true,
    type: Text,
    key: null,
    ref: null,
    props: { text },
    el: null,
    component: null,
  }
}

/** 创建 VNode（internal 工厂：渲染器与 JSX runtime 的底层入口） */
export function createVNode<Type extends VNodeTypes>(
  type: Type,
  props: Record<string, any> | null = null,
  key: VNodeKey = null,
): VNode<Type> {
  return {
    __v_isVNode: true,
    type,
    key,
    ref: null,
    props,
    el: null,
    component: null,
  }
}

/** 是否 VNode（内部结构判定；公开层用 isValidElement） */
export function isVNode(value: unknown): value is VNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __v_isVNode?: unknown }).__v_isVNode === true
  )
}
