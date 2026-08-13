// ============================================================
// vnode.ts — core 自持的 VNode 类型体系
// 与 @actview/jsx 的 VNode 定义结构兼容（TS 结构类型互认）：
// 消费方用 @actview/jsx 工厂产生的元素可直接用于 core 的类型签名。
// 目的：断开 core → @actview/jsx 的类型依赖（jsx 保持零依赖底座）。
// 注意：与 packages/jsx/src/types.ts 保持形状一致，改动需同步。
// ============================================================

/** VNode 的 type 字段允许的类型 */
export type VNodeTypes = string | symbol | ((props: any) => any)

/** VNode key */
export type VNodeKey = string | number | null

/** VNode 描述对象（与 @actview/jsx 的 VNode 形状一致） */
export interface VNode<Type = VNodeTypes> {
  $$typeof: symbol
  type: Type
  key: VNodeKey
  ref: any
  props: Record<string, any> | null
  /** 指向真实 DOM（渲染后挂载） */
  el?: Node | null
}

/** 组件类型：defineComponent 产物（{ __setup } + call signature），props 泛型化 */
export type ComponentType<P = any> = {
  __setup: (props: P, ctx?: any) => any
} & ((props: P) => any)

/** 从组件类型推导 props：取 __setup 的第一个参数 */
export type PropsOf<T> = T extends { __setup: (props: infer P) => any }
  ? P
  : T extends (props: infer P) => any
    ? P
    : {}

export type VNodeChild = VNode | string | number | boolean | null | undefined
export type VNodeChildren = VNodeChild | VNodeChild[]

/** 组件 setup 返回的 render 函数类型 */
export type LazyVNode = () => VNode

/** 读取 VNode children：优先 __children（babel 编译产物，children 与静态 props 分离），
 * 否则回退 props.children（手写 _jsx / esbuild 产物 / 运行时包装）。
 * renderer 与内置组件（KeepAlive/Teleport/Transition/Suspense）共用，
 * 放本文件避免 renderer ↔ transition 循环依赖。 */
export function getChildren(vnode: any): any {
  return vnode && vnode.__children !== undefined
    ? vnode.__children
    : vnode?.props?.children
}
