// ============================================================
// 公开元素工厂（public）
//
// 公开层只能构造 / 校验 Element 契约，不暴露 VNode 内部类型：
//   - createElement 返回 Element（运行时对象是 VNode，属实现细节）；
//   - isValidElement 做结构判定；
//   - Fragment 是公开的片段标记值。
// 内部渲染器需要 VNode 时走 ./internal 的 createVNode / isVNode。
// ============================================================

import { createVNode, isVNode, Fragment } from './vnode'
import type { Element, ElementType } from './element'

export { Fragment }

/**
 * 创建元素（低层工厂，JSX 编译产物经 jsx() 调用到这里）。
 * 公开返回类型是 Element；VNode 结构不进入公开契约。
 */
export function createElement(
  type: ElementType,
  props: Record<string, any> | null = null,
  key: string | number | null = null,
): Element {
  return createVNode(type, props, key)
}

/** 是否合法元素（公开结构判定） */
export function isValidElement(value: unknown): value is Element {
  return isVNode(value)
}
