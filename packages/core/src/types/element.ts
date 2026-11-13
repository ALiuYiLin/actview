// ============================================================
// 公开元素 / 组件类型契约（public type layer）
//
// 分层约定（详见 docs/types-architecture.md）：
//   - 本文件 = 用户与公开 API 只能看到的「元素 / 组件」类型；
//   - 渲染器内部类型（VNode 等）在 vnode.ts，只经 ./internal 入口暴露；
//   - 公开 Element 只承诺 4 个稳定字段；渲染器字段（__v_isVNode /
//     el / component / 子节点缓存…）不属于公开契约。
// ============================================================

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
  | ClassComponent<any>
  | BuiltinComponent

/**
 * 内置组件标记（Teleport / Transition）：renderer 按 `__builtin` 特判，
 * 不是普通类组件。
 */
export interface BuiltinComponent {
  readonly __builtin?: string
}

/**
 * 类组件构造器（第一版类组件目标形态）。
 *
 * 类必须实现 render()，并由 `@Component` 标记；渲染器负责实例化、安装
 * @Prop / @Ref 访问器、执行 setup 与生命周期，再驱动 render effect。
 */
export interface ClassComponent<P = Record<string, any>> {
  new (props: P): { render(): Element | null }
}

/**
 * 从类组件构造器推导 props。
 *
 * 优先从实例的 `$props`（ActViewComponent<P> 的基类声明）推导，这样即使
 * 子类没有显式 constructor 也能得到精确 props；否则退回构造器第一个参数。
 */
export type ComponentProps<C> = C extends new (
  ...args: any[]
) => { $props: infer P }
  ? P
  : C extends new (props: infer P, ...rest: any[]) => any
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
