// ============================================================
// VNode 类型定义 — 类似 Vue 的虚拟节点描述对象
// ============================================================

/** Fragment 标记 */
export const Fragment: unique symbol = Symbol.for('actview.fragment')

/** 组件类型：()=>()=>VNode，外层 setup 内层 render */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Component<P = any> = (props: P) => () => VNode

/** VNode 的可序列化 key */
export type VNodeKey = string | number | null

/** VNode 子节点的基础单元 */
export type VNodeChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void

/** VNode 子节点 — 单个或数组 */
export type VNodeChildren = VNodeChild | VNodeChild[]

// ============================================================
// VNode 描述对象（对标 Vue 的 VNode）
// ============================================================
export interface VNode<
  Props = Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Type = string | Component<any> | typeof Fragment,
> {
  /** 标签名、组件函数 或 Fragment */
  type: Type

  /** 属性/props 对象（不含 children） */
  props: Props | null

  /** 标准化后的子节点 */
  children: VNodeChildren | null

  /** 用于 diff 的 key */
  key: VNodeKey

  /** ref 引用 */
  ref: unknown

  /** 指向真实 DOM（渲染后挂载） */
  el?: Node | null
}

// ============================================================
// HTML 属性类型 — 用于 JSX.IntrinsicElements
// ============================================================

/** 通用 HTML 元素属性 */
export interface HtmlProps {
  // 核心属性
  id?: string
  class?: string
  className?: string
  style?: string | Record<string, string | number>
  title?: string
  lang?: string
  dir?: string
  hidden?: boolean
  tabindex?: number
  accesskey?: string
  contenteditable?: boolean
  draggable?: boolean
  spellcheck?: boolean
  slot?: string
  part?: string
  exportparts?: string
  inert?: boolean

  // WAI-ARIA
  role?: string

  // 事件处理器（on 前缀 = 原生 DOM 事件）
  onclick?: (e: Event) => void
  ondblclick?: (e: Event) => void
  onmousedown?: (e: Event) => void
  onmouseup?: (e: Event) => void
  onmousemove?: (e: Event) => void
  onmouseenter?: (e: Event) => void
  onmouseleave?: (e: Event) => void
  onmouseover?: (e: Event) => void
  onmouseout?: (e: Event) => void
  onfocus?: (e: FocusEvent) => void
  onblur?: (e: FocusEvent) => void
  onkeydown?: (e: KeyboardEvent) => void
  onkeyup?: (e: KeyboardEvent) => void
  onkeypress?: (e: KeyboardEvent) => void
  onchange?: (e: Event) => void
  oninput?: (e: Event) => void
  onsubmit?: (e: SubmitEvent) => void
  onscroll?: (e: Event) => void
  onwheel?: (e: WheelEvent) => void
  onload?: (e: Event) => void
  onerror?: (e: Event | string) => void
  onresize?: (e: Event) => void
  onpointerdown?: (e: PointerEvent) => void
  onpointerup?: (e: PointerEvent) => void
  onpointermove?: (e: PointerEvent) => void
  onpointerenter?: (e: PointerEvent) => void
  onpointerleave?: (e: PointerEvent) => void
  ontouchstart?: (e: TouchEvent) => void
  ontouchend?: (e: TouchEvent) => void
  ontouchmove?: (e: TouchEvent) => void
  ontransitionend?: (e: TransitionEvent) => void
  onanimationend?: (e: AnimationEvent) => void

  // data-* 属性
  [key: `data-${string}`]: unknown

  // 任意自定义属性（兜底）
  [key: string]: unknown
}

/** input 元素特有属性 */
export interface InputProps extends HtmlProps {
  type?:
    | 'text'
    | 'password'
    | 'email'
    | 'number'
    | 'checkbox'
    | 'radio'
    | 'file'
    | 'submit'
    | 'reset'
    | 'button'
    | 'range'
    | 'date'
    | 'time'
    | 'color'
    | 'hidden'
    | 'search'
    | 'tel'
    | 'url'
    | 'month'
    | 'week'
    | 'datetime-local'
  value?: string | number | readonly string[]
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  checked?: boolean
  name?: string
  min?: number | string
  max?: number | string
  step?: number | string
  autocomplete?: string
  autofocus?: boolean
  accept?: string
  multiple?: boolean
  pattern?: string
  minlength?: number
  maxlength?: number
  size?: number
  src?: string
  alt?: string
  list?: string
}

// ============================================================
// 创建一个 VNode 的工厂函数
// ============================================================
export function createVNode<
  Props = Record<string, unknown>,
  Type = string | Component | typeof Fragment,
>(
  type: Type,
  props: Props | null,
  children: VNodeChildren | null,
  key: VNodeKey = null,
  ref: unknown = null,
): VNode<Props, Type> {
  return {
    type,
    props,
    children,
    key,
    ref,
    el: null,
  }
}
