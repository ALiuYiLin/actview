// ============================================================
// 组件运行时类型（internal）
//
// 本文件的类型描述「编译产物 / 渲染器」看到的世界，不直接从公开入口导出：
//   - Component 是 defineComponent 的运行时产物（普通对象，不可调用）；
//   - ComponentInternalInstance 是挂载后的实例（渲染器 / 生命周期用）；
//   - 公开层能看到的组件类型是 element.ts 的 ComponentTag（JSX 标签视图）
//     与 ComponentFunction（源码函数视图）。
// ============================================================

import type {
  ComponentTag,
  Element,
} from './element'
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
 * 运行时组件对象（defineComponent 产物）。普通对象，**不可调用**。
 *
 * 公开层用 ComponentTag = Component & call signature 表达「JSX 标签视角」；
 * 任何真正持有组件值的内部代码都应使用本类型（禁止调用）。
 */
export interface Component<P = Record<string, any>> {
  readonly __setup: SetupFunction<P>
  /** 组件名（KeepAlive include/exclude、DevTools 等使用） */
  readonly name?: string
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
