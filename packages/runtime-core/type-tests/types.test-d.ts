// ============================================================
// 编译期类型测试（type-tests，不执行）：
//   - 公开元素 Element 只暴露稳定字段，不泄漏 VNode 内部字段
//   - 源码组件是函数；编译产物是 ComponentTag（JSX 标签视图）
//   - ComponentProps 同时支持两种视图
//   - VNode 是 Element 的子类型；公开入口不导出 VNode
//   - 运行时组件对象（Component）不可调用
// ============================================================

import type {
  ComponentFunction,
  ComponentTag,
  ComponentProps,
  Element,
  ElementChildren,
  ElementType,
  RenderFunction,
  SetupContext,
} from '../src/index'

import type {
  Component,
  ComponentInternalInstance,
  VNode,
  VNodeTypes,
} from '../src/internal'

import { createElement } from '../src/index'
import { createVNode, isVNode } from '../src/internal'

// ------------------------------------------------------------
// 1. 公开入口不导出内部类型（VNode 属于 ./internal）
// ------------------------------------------------------------
// @ts-expect-error 公开入口不导出 VNode
type HiddenVNode = import('../src/index').VNode
export type PublicEntryHidesVNode = HiddenVNode

// ------------------------------------------------------------
// 2. VNode 是公开 Element 的子类型：内部类型可安全跨越公开边界
// ------------------------------------------------------------
declare const vnode: VNode
export const vnodeAsElement: Element = vnode
export const vnodeTypeAsElementType: ElementType = vnode.type
export const vnodeIsVNode: boolean = isVNode(vnode)
export const vnodeTypesSample: VNodeTypes = vnode.type

// ------------------------------------------------------------
// 3. 公开 Element 不包含渲染器内部字段
// ------------------------------------------------------------
declare const element: Element
export const elementProps: Record<string, any> | null = element.props
export const elementKey: string | number | null = element.key
export const elementRef: unknown = element.ref
// @ts-expect-error 渲染器品牌字段不属于公开契约
element.__v_isVNode
// @ts-expect-error 宿主节点字段不属于公开契约
element.el
// @ts-expect-error 组件实例字段不属于公开契约
element.component

// ------------------------------------------------------------
// 4. 源码函数视图（ComponentFunction）可作为 JSX 标签类型
// ------------------------------------------------------------
type FnProps = { a: number }
declare const fnComponent: ComponentFunction<FnProps>
export const fnAsElementType: ElementType = fnComponent

export type PropsFromFunction = ComponentProps<ComponentFunction<FnProps>>
const propsFromFunction: PropsFromFunction = { a: 1 }
export { propsFromFunction }

// ------------------------------------------------------------
// 5. 编译产物视图（ComponentTag）是标签类型；内部 Component 不可调用
// ------------------------------------------------------------
declare const tag: ComponentTag<{ id: string }>
export const tagAsElementType: ElementType = tag
export type PropsFromTag = ComponentProps<typeof tag>
const propsFromTag: PropsFromTag = { id: 'x' }
export { propsFromTag }

declare const component: Component<{ id: string }>
// @ts-expect-error 运行时组件对象不可调用（调用签名只属于公开 tag 视图）
component({ id: 'x' })
export const componentName: string | undefined = component.name

// ------------------------------------------------------------
// 6. 公开工厂返回 Element；内部工厂返回 VNode
// ------------------------------------------------------------
export const createdByPublicFactory: Element = createElement('div', { id: 'x' })
export const createdByInternalFactory: VNode = createVNode('span')
export const createdAsElement: Element = createdByInternalFactory

// ------------------------------------------------------------
// 7. 其它公开基础类型
// ------------------------------------------------------------
export const children: ElementChildren = [createdAsElement, 'text', 1, null]
declare const setup: (props: FnProps, ctx: SetupContext) => RenderFunction
export type SetupShape = typeof setup

declare const instance: ComponentInternalInstance
export const instanceUid: number = instance.uid
export const instanceSubTree: VNode | null = instance.subTree
