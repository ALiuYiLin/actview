// ============================================================
// 公开元素 / 组件类型契约（public type layer）
//
// 分层约定（详见 docs/types-architecture.md）：
//   - 本文件 = 用户与公开 API 只能看到的「元素 / 组件」类型；
//   - 渲染器内部类型（VNode 等）在 vnode.ts，只经 ./internal 入口暴露；
//   - 公开 Element 只承诺 4 个稳定字段；渲染器字段（__v_isVNode /
//     el / component / 子节点缓存…）不属于公开契约。
// ============================================================

import type { Component } from './component'

/**
 * 公开元素契约：所有 JSX 表达式、render 返回值、children 的静态类型。
 *
 * 只包含跨层稳定字段：
 *   - type：标签名 / Fragment symbol / 组件（源码函数或编译后组件的 tag 视图）
 *   - key：渲染 key
 *   - props：元素 / 组件 props（children 位于 props.children）
 *   - ref：模板引用
 *
 * 渲染器内部 VNode 是它的子类型（见 vnode.ts），内部字段不会出现在这里。
 * 字段 readonly：公开层不承诺可写，内部更新由渲染器实现。
 */
export interface Element {
  readonly type: ElementType
  readonly key: string | number | null
  readonly props: Record<string, any> | null
  readonly ref: unknown
}

/** 可作为 JSX 标签 / 元素 type 的类型 */
export type ElementType =
  | string
  | symbol
  | ComponentFunction<any>
  | ComponentTag<any>

/**
 * 源码层组件：用户书写的组件函数（compiler 转换之前）。
 *
 *   function Hello(props: Props) { return <div /> }
 *   // 公开类型 = (props: Props) => Element | null
 *
 * 返回值限制为 Element | null：返回普通值（number / string / 对象）的
 * 函数不是组件，作为 JSX 标签或公开 API 入参时会在类型期报错。
 */
export type ComponentFunction<P = Record<string, any>> = (
  props: P,
) => Element | null

/**
 * 编译后组件的「JSX 标签视图」（公开层）。
 *
 * 运行时值是普通对象 { __setup, name? }，**不可调用**；但 TypeScript 要求
 * JSX 标签必须有 call / construct signature，所以公开类型把调用签名作为
 * 「仅用于 JSX 检查」的视图保留下来：
 *   - 命名用 ComponentTag（标签）而不是 Component（对象），提醒这只是标签视角；
 *   - 真正不可调用的运行时形状见 runtime-core/internal 的 Component。
 */
export interface ComponentTag<P = Record<string, any>> extends Component<P> {
  (props: P): any
}

/**
 * 从组件推导 props。同时支持两种视图：
 *   1) 编译产物：{ __setup: (props: P, ...) => RenderFunction }
 *   2) 源码函数：  (props: P) => Element | null
 *
 * 用 `...rest` 吸收 setup 的第二个参数（SetupContext），避免 infer 失配。
 */
export type ComponentProps<C> = C extends {
  readonly __setup: (props: infer P, ...rest: any[]) => any
}
  ? P
  : C extends (props: infer P, ...rest: any[]) => any
    ? P
    : {}

/** 单个子节点（渲染器会忽略 boolean / null / undefined） */
export type ElementChild =
  | Element
  | string
  | number
  | boolean
  | null
  | undefined

/** children 类型：允许嵌套数组，对齐运行时 children 展平 */
export type ElementChildren = ElementChild | ElementChildren[]
