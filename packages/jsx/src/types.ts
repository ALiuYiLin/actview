// ============================================================
// VNode 与属性类型
// ============================================================

/** VNode 的 type 字段允许的类型 */
export type VNodeTypes = string | symbol | ((props: any) => any)

/** VNode key */
export type VNodeKey = string | number | null

/** VNode 描述对象 */
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
  __props?: readonly string[]
  __inheritAttrs?: boolean
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

// ============================================================
// 事件类型
// ============================================================

/** 表单事件 — target 上带 value/checked 等输入属性 */
export interface FormEvent extends Event {
  target: EventTarget & {
    value: string
    checked: boolean
  }
}

// ============================================================
// 属性类型 — 用于 JSX.IntrinsicElements
// ============================================================

/** 通用 HTML 元素属性 */
export interface HtmlProps {
  id?: string
  class?: string
  className?: string
  style?: string | Record<string, string | number>
  title?: string
  value?: string | number | readonly string[]
  checked?: boolean
  disabled?: boolean
  placeholder?: string
  name?: string
  type?: string
  href?: string
  src?: string

  // 事件处理器（小写形式，兼容旧写法）
  onclick?: (e: MouseEvent) => void
  ondblclick?: (e: MouseEvent) => void
  onmousedown?: (e: MouseEvent) => void
  onmouseup?: (e: MouseEvent) => void
  onmouseover?: (e: MouseEvent) => void
  onmouseout?: (e: MouseEvent) => void
  onfocus?: (e: FocusEvent) => void
  onblur?: (e: FocusEvent) => void
  onkeydown?: (e: KeyboardEvent) => void
  onkeyup?: (e: KeyboardEvent) => void
  onchange?: (e: FormEvent) => void
  oninput?: (e: FormEvent) => void
  onsubmit?: (e: FormEvent) => void
  onselect?: (e: FormEvent) => void

  // 事件处理器（camelCase，推荐写法；与 DOM 事件对应）
  onClick?: (e: MouseEvent) => void
  onDblClick?: (e: MouseEvent) => void
  onMouseDown?: (e: MouseEvent) => void
  onMouseUp?: (e: MouseEvent) => void
  onMouseOver?: (e: MouseEvent) => void
  onMouseOut?: (e: MouseEvent) => void
  onMouseMove?: (e: MouseEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onKeyDown?: (e: KeyboardEvent) => void
  onKeyUp?: (e: KeyboardEvent) => void
  onKeyPress?: (e: KeyboardEvent) => void
  onChange?: (e: FormEvent) => void
  onInput?: (e: FormEvent) => void
  onSubmit?: (e: FormEvent) => void
  onSelect?: (e: FormEvent) => void
  onScroll?: (e: Event) => void
  onLoad?: (e: Event) => void
  onError?: (e: Event) => void
  // capture 变体（onXxxCapture → 捕获阶段监听）
  onClickCapture?: (e: MouseEvent) => void
  onMouseDownCapture?: (e: MouseEvent) => void
  onKeyDownCapture?: (e: KeyboardEvent) => void
  onChangeCapture?: (e: FormEvent) => void
  onInputCapture?: (e: FormEvent) => void

  [key: `data-${string}`]: unknown
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
  checked?: boolean
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  accept?: string
  multiple?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  minlength?: number
  maxlength?: number
}
