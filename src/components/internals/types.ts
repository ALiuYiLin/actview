// ============================================================
// 类型层 —— Base UI internals/types.ts 的 ActView 等价物
//
// 差异说明：
//  - 事件为原生 DOM 事件（无 React SyntheticEvent），因此省去
//    WithBaseUIEvent 的类型变换；运行时 mergeProps 仍会在事件对象上挂
//    preventBaseUIHandler（原生 Event 同样可挂载方法）。
//  - ReactElement 对应 ActView 的 VNode 形态（RenderableNode 结构化最小形状）。
// ============================================================

import type { Ref } from 'actview'

export type HTMLProps = JSX.IntrinsicElements['div']



/**
 * render 函数形态：收(合并后的 props, state) 返回节点
 * （与 Base UI evaluateRenderProp 的 render(props, state) 调用一致）
 */
export type ComponentRenderFn<Props, State> = (
  props: Props & Partial<State> & { ref?: any },
  state: State,
) => any

/**
 * 所有无头组件共享的 props 基座：
 *  - 继承标签的宿主属性（actview 全局 JSX.IntrinsicElements）
 *  - className/style 支持 string|object 与 (state)=>… 函数双形态
 *  - render 支持节点实例 / 渲染函数两种接管形态
 *  - ref 为可转发引用（父 <Comp ref={x}/> 经 props.ref 到达，React19 形态）
 */
// ⚠️ 必须用「类型别名 + 交叉」而非 interface extends——Tag 是裸类型参数,
// 泛型索引访问非静态已知成员,接口继承会报 TS2312（同 Reactive<T> 的处理）
export type BaseUIComponentProps<
  Tag extends keyof JSX.IntrinsicElements,
  State,
  RenderFunctionProps = HTMLProps,
> = Omit<JSX.IntrinsicElements[Tag], 'className' | 'style' | 'ref'> & {
  /** CSS class;支持基于 state 的函数形态（resolveClassName 求值） */
  className?: string | ((state: State) => string | undefined) | undefined
  /** 接管渲染:节点实例（clone 合并）或渲染函数 */
  render?: JSX.Element | ComponentRenderFn<RenderFunctionProps, State> | undefined
  /** 样式对象;支持基于 state 的函数形态（resolveStyle 求值） */
  style?:
    | Record<string, any>
    | ((state: State) => Record<string, any> | undefined)
    | undefined
  /** 转发用根元素引用（由使用方 <Comp ref={x}/> 传入） */
  ref?: Ref<HTMLElement | null>
}
