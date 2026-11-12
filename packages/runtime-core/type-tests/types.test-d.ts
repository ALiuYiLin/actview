// ============================================================
// 编译期类型测试（type-tests，不执行）：
//   - 公开元素 Element 只暴露稳定字段，不泄漏 VNode 内部字段
//   - 第一版组件 = @Component 类构造器；JSX 标签类型 / ComponentProps 推导
//   - VNode 是 Element 的子类型；公开入口不导出 VNode / ComponentInternalInstance
// ============================================================

import type {
  ClassComponent,
  ComponentProps,
  Element,
  ElementChildren,
  ElementType,
} from '../src/index'

import type {
  ClassComponentCtor,
  ComponentInternalInstance,
  VNode,
  VNodeTypes,
} from '../src/internal'

import { createElement, isComponent } from '../src/index'
import { createVNode, isVNode } from '../src/internal'

// ------------------------------------------------------------
// 1. 公开入口不导出内部类型
// ------------------------------------------------------------
// @ts-expect-error 公开入口不导出 VNode
type HiddenVNode = import('../src/index').VNode
export type PublicEntryHidesVNode = HiddenVNode

// @ts-expect-error 公开入口不导出 ComponentInternalInstance
type HiddenInstance = import('../src/index').ComponentInternalInstance
export type PublicEntryHidesInstance = HiddenInstance

// ------------------------------------------------------------
// 2. VNode 是公开 Element 的子类型
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
// 4. 类组件视图：ClassComponent / ComponentProps
// ------------------------------------------------------------
interface ClassProps {
  id: string
}

declare const classComponent: ClassComponent<ClassProps>
export const classAsElementType: ElementType = classComponent

export type PropsFromClass = ComponentProps<typeof classComponent>
const propsFromClass: PropsFromClass = { id: 'x' }
export { propsFromClass }
// @ts-expect-error ComponentProps 推导精确（不是 unknown / {}）
const wrongPropsFromClass: PropsFromClass = { id: 1 }
export { wrongPropsFromClass }

// ------------------------------------------------------------
// 5. isComponent 收窄到 ClassComponentCtor
// ------------------------------------------------------------
export function narrowToClassComponent(
  value: unknown,
): ClassComponentCtor | null {
  return isComponent(value) ? value : null
}

// ------------------------------------------------------------
// 6. 公开工厂返回 Element；内部工厂返回 VNode
// ------------------------------------------------------------
export const createdByPublicFactory: Element = createElement('div', { id: 'x' })
export const createdByInternalFactory: VNode = createVNode('span')
export const createdAsElement: Element = createdByInternalFactory

// ------------------------------------------------------------
// 7. 其它公开基础类型 / 内部实例
// ------------------------------------------------------------
export const children: ElementChildren = [createdAsElement, 'text', 1, null]

declare const instance: ComponentInternalInstance
export const instanceUid: number = instance.uid
export const instanceSubTree: VNode | null = instance.subTree
export const instanceType: ClassComponentCtor = instance.type as ClassComponentCtor
