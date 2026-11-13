// ============================================================
// 组件运行时类型（internal）
//
// 第一版类组件：组件 = 带 `__actview_class_component` 标记的 class 构造器，
// 必须实现 render()；渲染器创建实例、安装 @Prop / @Ref accessor、执行
// @Setup 与生命周期，再驱动 render effect。
// ============================================================

import type { Element } from './element'
import type { VNode } from '../runtime/vnode'

/** 渲染函数：每次更新执行，返回公开元素（运行时是 VNode） */
export type RenderFunction = () => Element | null

/** 类组件标记字段名（@Component 装饰器写入 / isClassComponent 读取） */
export const CLASS_COMPONENT_MARKER = '__actview_class_component'

/** 类组件构造器（运行时形状；由 @Component 标记） */
export type ClassComponentCtor<P = Record<string, any>> = (new (
  props: P,
) => { render(): Element | null }) & {
  readonly __actview_class_component?: true
  readonly name?: string
}

/**
 * 是否类组件：只看 @Component 写入的标记（强制显式装饰器，不做
 * “有 render 方法就算组件”的隐式猜测）。
 */
export function isClassComponent(
  value: unknown,
): value is ClassComponentCtor {
  return (
    typeof value === 'function' &&
    (value as { __actview_class_component?: unknown })
      .__actview_class_component === true
  )
}

/** 是否组件：第一版只认 @Component 类组件标记。 */
export function isComponent(value: unknown): value is ClassComponentCtor {
  return isClassComponent(value)
}

/**
 * 组件实例（internal）：挂载 / 更新 / 卸载期间由渲染器维护。
 * 类型基础阶段只声明跨模块稳定的最小字段，实现阶段按需扩展。
 */
export interface ComponentInternalInstance {
  readonly uid: number
  readonly type: ClassComponentCtor
  readonly parent: ComponentInternalInstance | null
  readonly props: Record<string, any>
  render: RenderFunction | null
  subTree: VNode | null
  isMounted: boolean
}
