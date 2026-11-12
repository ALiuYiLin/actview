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

/** 组件 setup：props 全量进 setup（React 语义，无 props/attrs 分离）。
 *
 * 返回 render 函数（同步），或 `Promise<RenderFunction>`（async setup，
 * 由渲染器向最近的 Suspense 注册、resolve 后重新渲染）。 */
export type SetupFunction<P = Record<string, any>> = (
  props: P,
  ctx: SetupContext,
) => RenderFunction | Promise<RenderFunction>

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
 * 是否组件：函数组件（带 `__actview_component` 标记）或类组件
 * （带 `__actview_class_component` 标记）。
 *
 * 第一版类组件目标形态下，函数组件路径后续会删除；这里先保留两个分支，
 * 便于类路径与现有渲染器测试并行迁移。
 */
export function isComponent(
  value: unknown,
): value is Component | ClassComponentCtor {
  if (typeof value !== 'function') return false
  const v = value as {
    __actview_component?: unknown
    __actview_class_component?: unknown
  }
  return (
    v.__actview_component === true || v.__actview_class_component === true
  )
}

/**
 * 组件实例（internal）：挂载 / 更新 / 卸载期间由渲染器维护。
 * 类型基础阶段只声明跨模块稳定的最小字段，实现阶段按需扩展。
 */
export interface ComponentInternalInstance {
  readonly uid: number
  readonly type: ComponentTag | ClassComponentCtor
  readonly parent: ComponentInternalInstance | null
  readonly props: Record<string, any>
  render: RenderFunction | null
  subTree: VNode | null
  isMounted: boolean
}
