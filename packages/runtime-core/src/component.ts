// ============================================================
// 组件运行时类型与工厂（internal 类型 + 公开工厂）
//
// 组件 = setup 函数本体：defineComponent 不包装、不改变函数形状，只在
// 函数对象上写入 `__actview_component: true` 标记（以及可选的 name）：
//   - Component / SetupFunction / ComponentInternalInstance 是内部类型，
//     只经 ./internal 暴露；公开入口不导出 Component；
//   - 公开层把 defineComponent 的返回值视为 ComponentTag（JSX 标签视图，
//     见 element.ts）；运行时它就是可调用的 setup 函数。
// ============================================================

import type { ComponentTag, Element } from './element'
import type { VNode } from './vnode'

/** setup 上下文（provide/inject 等注入表；后续按需扩展） */
export interface SetupContext {
  /** 注入表：继承自最近提供方（未使用 provide 的组件共享父引用） */
  readonly injects: Record<PropertyKey, any>
}

/** setup 返回的渲染函数：每次更新执行，返回公开元素（运行时是 VNode） */
export type RenderFunction = () => Element | null

/** 组件 setup：props 全量进 setup（React 语义，无 props/attrs 分离） */
export type SetupFunction<P = Record<string, any>> = (
  props: P,
  ctx: SetupContext,
) => RenderFunction

/**
 * 运行时组件（internal）：就是 defineComponent 传入的 setup 函数本体。
 *
 * 用 `type` 交叉而不是 `interface extends`（interface 不能 extend 函数类型）。
 * 公开层不导出本类型；JSX 标签视图见 element.ts 的 ComponentTag。
 */
export type Component<P = Record<string, any>> = SetupFunction<P> & {
  /** 组件标记（defineComponent 写入、isComponent 判定） */
  readonly __actview_component: true
  /** 组件名（KeepAlive include/exclude、DevTools 等使用） */
  readonly name?: string
}

/** 组件标记字段名（defineComponent 写入 / isComponent 读取） */
export const COMPONENT_MARKER = '__actview_component'

/**
 * 定义组件：返回**同一个 setup 函数对象**，并在其上写入组件标记。
 *
 * - 标记 `__actview_component: true`：`enumerable: false` / `writable: false` /
 *   `configurable: true`；
 * - 传入 name 时改写函数 `name`（`configurable: true`），便于调试 / DevTools；
 * - 幂等：重复调用（含重复设置 name）不报错，仍返回同一函数；
 * - 组件仍是普通函数，`setup(props, ctx)` 可直接调用并返回 render 函数。
 */
export function defineComponent<P = Record<string, any>>(
  setup: SetupFunction<P>,
  name?: string,
): ComponentTag<P> {
  const component = setup as unknown as ComponentTag<P>
  Object.defineProperty(component, COMPONENT_MARKER, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: false,
  })
  if (name !== undefined) {
    Object.defineProperty(component, 'name', {
      value: name,
      enumerable: false,
      configurable: true,
      writable: false,
    })
  }
  return component
}

/**
 * 是否组件（渲染层判断「是不是组件函数」的唯一入口）。
 *
 * 只看函数对象上的 `__actview_component` 标记：普通函数、对象、仅带同名
 * 标记但不可调用的对象都不是组件。
 */
export function isComponent(value: unknown): value is Component {
  return (
    typeof value === 'function' &&
    (value as { __actview_component?: unknown }).__actview_component === true
  )
}

/**
 * 组件实例（internal）：挂载 / 更新 / 卸载期间由渲染器维护。
 * 类型基础阶段只声明跨模块稳定的最小字段，实现阶段按需扩展。
 */
export interface ComponentInternalInstance {
  readonly uid: number
  readonly type: ComponentTag
  readonly parent: ComponentInternalInstance | null
  readonly props: Record<string, any>
  render: RenderFunction | null
  subTree: VNode | null
  isMounted: boolean
}
