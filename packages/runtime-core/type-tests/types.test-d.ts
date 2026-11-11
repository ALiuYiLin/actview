// ============================================================
// 编译期类型测试（type-tests，不执行）：
//   - 公开元素 Element 只暴露稳定字段，不泄漏 VNode 内部字段
//   - 源码组件是函数；defineComponent 产物是 ComponentTag（JSX 标签视图）
//   - ComponentProps 同时支持两种视图
//   - VNode 是 Element 的子类型；公开入口不导出 VNode / Component
//   - 运行时组件（内部 Component）= setup 函数本体 + __actview_component 标记
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
  SetupFunction,
  VNode,
  VNodeTypes,
} from '../src/internal'

import { createElement, defineComponent, isComponent } from '../src/index'
import { createVNode, isVNode } from '../src/internal'

// ------------------------------------------------------------
// 1. 公开入口不导出内部类型（VNode / Component 属于 ./internal）
// ------------------------------------------------------------
// @ts-expect-error 公开入口不导出 VNode
type HiddenVNode = import('../src/index').VNode
export type PublicEntryHidesVNode = HiddenVNode

// @ts-expect-error 公开入口不导出 Component（组件运行时形状仍属内部边界）
type HiddenComponent = import('../src/index').Component
export type PublicEntryHidesComponent = HiddenComponent

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
// @ts-expect-error ComponentProps 推导精确（不是 unknown / {}）
const wrongPropsFromFunction: PropsFromFunction = { a: 'x' }
export { wrongPropsFromFunction }

// ------------------------------------------------------------
// 5. 编译产物视图（ComponentTag）是标签类型；内部 Component 即 setup 本体
// ------------------------------------------------------------
declare const tag: ComponentTag<{ id: string }>
export const tagAsElementType: ElementType = tag
export type PropsFromTag = ComponentProps<typeof tag>
const propsFromTag: PropsFromTag = { id: 'x' }
export { propsFromTag }
// @ts-expect-error ComponentProps 从 ComponentTag 推导精确（不是 unknown / {}）
const wrongPropsFromTag: PropsFromTag = { id: 1 }
export { wrongPropsFromTag }

declare const component: Component<{ id: string }>
// 运行时组件就是 setup 函数本体：可调用并返回 render 函数
export const componentAsSetup: SetupFunction<{ id: string }> = component
export const componentRender: RenderFunction = component(
  { id: 'x' },
  { injects: {} },
)
export const componentMarker: true = component.__actview_component
export const componentName: string | undefined = component.name
// @ts-expect-error 内部 Component 的调用签名来自 setup（必须传 props + ctx）
component({ id: 'x' })

// defineComponent：公开返回 ComponentTag<P>，P 来自 setup 的 props 参数
const defined = defineComponent(
  (props: { id: string }) => () => createElement('span', { id: props.id }),
  'Span',
)
export const definedAsTag: ComponentTag<{ id: string }> = defined
export type PropsFromDefined = ComponentProps<typeof defined>
const propsFromDefined: PropsFromDefined = { id: 'x' }
export { propsFromDefined }
export const definedAsSetup: SetupFunction<{ id: string }> = defined

// isComponent：unknown 收窄到内部 Component（可当 setup 调用）
export function narrowToComponent(value: unknown): Component | null {
  return isComponent(value) ? value : null
}

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
export const instanceType: ComponentTag = instance.type
