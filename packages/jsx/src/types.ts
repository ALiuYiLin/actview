// ============================================================
// VNode 与属性类型 — 完整 TSX 类型体系
//   - VNode / ComponentType / PropsOf
//   - DOM 事件全量 + ARIA + HTML 通用属性 + 各元素专属 + SVG
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
} & ((props: P) => any)

/** 从组件类型推导 props：取 __setup 的第一个参数 */
export type PropsOf<T> = T extends { __setup: (props: infer P) => any }
  ? P
  : T extends (props: infer P) => any
    ? P
    : {}

/** children 递归：允许任意嵌套数组（map/数组变量混入 children 场景） */
export type VNodeChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | VNodeChild[]
export type VNodeChildren = VNodeChild

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

/**
 * 事件处理器通用形状（原生 DOM 事件，无合成事件包装）。
 * 用「方法双变」技巧（bivarianceHack，对齐 React）：TS 函数参数逆变检查下
 * `(e: MouseEvent) => void` 不能赋给 `(e: Event) => void`；方法参数按双变
 * 检查，放宽容器的赋值方向、保留 E 的精确类型（窄事件 handler 可赋给宽事件
 * prop；运行时 DOM 派发保证事件与声明元素匹配，实践中安全）。
 */
export type EventHandler<E extends Event = Event> = {
  bivarianceHack(event: E): void
}['bivarianceHack']

// ============================================================
// DOM 事件（全量常用，含 capture 变体）
// ============================================================

export interface DOMAttributes {
  // 鼠标
  onClick?: EventHandler<MouseEvent>
  onDblClick?: EventHandler<MouseEvent>
  onMouseDown?: EventHandler<MouseEvent>
  onMouseUp?: EventHandler<MouseEvent>
  onMouseMove?: EventHandler<MouseEvent>
  onMouseEnter?: EventHandler<MouseEvent>
  onMouseLeave?: EventHandler<MouseEvent>
  onMouseOver?: EventHandler<MouseEvent>
  onMouseOut?: EventHandler<MouseEvent>
  onContextMenu?: EventHandler<MouseEvent>
  // 键盘
  onKeyDown?: EventHandler<KeyboardEvent>
  onKeyUp?: EventHandler<KeyboardEvent>
  onKeyPress?: EventHandler<KeyboardEvent>
  // 焦点
  onFocus?: EventHandler<FocusEvent>
  onBlur?: EventHandler<FocusEvent>
  onFocusIn?: EventHandler<FocusEvent>
  onFocusOut?: EventHandler<FocusEvent>
  // 表单
  onInput?: EventHandler<FormEvent>
  onChange?: EventHandler<FormEvent>
  onSubmit?: EventHandler<FormEvent>
  onReset?: EventHandler<FormEvent>
  onInvalid?: EventHandler<FormEvent>
  onSelect?: EventHandler<FormEvent>
  onSearch?: EventHandler<FormEvent>
  // 剪贴板
  onCopy?: EventHandler<ClipboardEvent>
  onCut?: EventHandler<ClipboardEvent>
  onPaste?: EventHandler<ClipboardEvent>
  // 拖拽
  onDrag?: EventHandler<DragEvent>
  onDragStart?: EventHandler<DragEvent>
  onDragEnd?: EventHandler<DragEvent>
  onDragOver?: EventHandler<DragEvent>
  onDragEnter?: EventHandler<DragEvent>
  onDragLeave?: EventHandler<DragEvent>
  onDrop?: EventHandler<DragEvent>
  // 指针
  onPointerDown?: EventHandler<PointerEvent>
  onPointerUp?: EventHandler<PointerEvent>
  onPointerMove?: EventHandler<PointerEvent>
  onPointerEnter?: EventHandler<PointerEvent>
  onPointerLeave?: EventHandler<PointerEvent>
  // 触摸
  onTouchStart?: EventHandler<TouchEvent>
  onTouchEnd?: EventHandler<TouchEvent>
  onTouchMove?: EventHandler<TouchEvent>
  onTouchCancel?: EventHandler<TouchEvent>
  // 滚动 / 滚轮
  onScroll?: EventHandler<Event>
  onWheel?: EventHandler<WheelEvent>
  // 媒体 / 资源
  onLoad?: EventHandler<Event>
  onError?: EventHandler<Event>
  onAbort?: EventHandler<Event>
  onCanPlay?: EventHandler<Event>
  onEnded?: EventHandler<Event>
  onLoadedData?: EventHandler<Event>
  onPause?: EventHandler<Event>
  onPlay?: EventHandler<Event>
  onPlaying?: EventHandler<Event>
  onProgress?: EventHandler<Event>
  onTimeUpdate?: EventHandler<Event>
  onVolumeChange?: EventHandler<Event>
  onWaiting?: EventHandler<Event>
  // 动画 / 过渡
  onAnimationStart?: EventHandler<AnimationEvent>
  onAnimationEnd?: EventHandler<AnimationEvent>
  onTransitionEnd?: EventHandler<TransitionEvent>
  // capture 变体（主要事件）
  onClickCapture?: EventHandler<MouseEvent>
  onMouseDownCapture?: EventHandler<MouseEvent>
  onMouseUpCapture?: EventHandler<MouseEvent>
  onKeyDownCapture?: EventHandler<KeyboardEvent>
  onKeyUpCapture?: EventHandler<KeyboardEvent>
  onFocusCapture?: EventHandler<FocusEvent>
  onBlurCapture?: EventHandler<FocusEvent>
  onChangeCapture?: EventHandler<FormEvent>
  onInputCapture?: EventHandler<FormEvent>
  onSubmitCapture?: EventHandler<FormEvent>
  onScrollCapture?: EventHandler<Event>
  // 小写形式（历史兼容；运行时 parseEventKey 统一 toLowerCase，全量对齐驼峰版）
  onclick?: EventHandler<MouseEvent>
  ondblclick?: EventHandler<MouseEvent>
  onmousedown?: EventHandler<MouseEvent>
  onmouseup?: EventHandler<MouseEvent>
  onmousemove?: EventHandler<MouseEvent>
  onmouseenter?: EventHandler<MouseEvent>
  onmouseleave?: EventHandler<MouseEvent>
  onmouseover?: EventHandler<MouseEvent>
  onmouseout?: EventHandler<MouseEvent>
  oncontextmenu?: EventHandler<MouseEvent>
  onkeydown?: EventHandler<KeyboardEvent>
  onkeyup?: EventHandler<KeyboardEvent>
  onkeypress?: EventHandler<KeyboardEvent>
  onfocus?: EventHandler<FocusEvent>
  onblur?: EventHandler<FocusEvent>
  onfocusin?: EventHandler<FocusEvent>
  onfocusout?: EventHandler<FocusEvent>
  oninput?: EventHandler<FormEvent>
  onchange?: EventHandler<FormEvent>
  onsubmit?: EventHandler<FormEvent>
  onreset?: EventHandler<FormEvent>
  oninvalid?: EventHandler<FormEvent>
  onselect?: EventHandler<FormEvent>
  onsearch?: EventHandler<FormEvent>
  oncopy?: EventHandler<ClipboardEvent>
  oncut?: EventHandler<ClipboardEvent>
  onpaste?: EventHandler<ClipboardEvent>
  ondrag?: EventHandler<DragEvent>
  ondragstart?: EventHandler<DragEvent>
  ondragend?: EventHandler<DragEvent>
  ondragover?: EventHandler<DragEvent>
  ondragenter?: EventHandler<DragEvent>
  ondragleave?: EventHandler<DragEvent>
  ondrop?: EventHandler<DragEvent>
  onpointerdown?: EventHandler<PointerEvent>
  onpointerup?: EventHandler<PointerEvent>
  onpointermove?: EventHandler<PointerEvent>
  onpointerenter?: EventHandler<PointerEvent>
  onpointerleave?: EventHandler<PointerEvent>
  ontouchstart?: EventHandler<TouchEvent>
  ontouchend?: EventHandler<TouchEvent>
  ontouchmove?: EventHandler<TouchEvent>
  ontouchcancel?: EventHandler<TouchEvent>
  onscroll?: EventHandler<Event>
  onwheel?: EventHandler<WheelEvent>
  onload?: EventHandler<Event>
  onerror?: EventHandler<Event>
  onabort?: EventHandler<Event>
  oncanplay?: EventHandler<Event>
  onended?: EventHandler<Event>
  onloadeddata?: EventHandler<Event>
  onpause?: EventHandler<Event>
  onplay?: EventHandler<Event>
  onplaying?: EventHandler<Event>
  onprogress?: EventHandler<Event>
  ontimeupdate?: EventHandler<Event>
  onvolumechange?: EventHandler<Event>
  onwaiting?: EventHandler<Event>
  onanimationstart?: EventHandler<AnimationEvent>
  onanimationend?: EventHandler<AnimationEvent>
  ontransitionend?: EventHandler<TransitionEvent>
}

// ============================================================
// ARIA 属性
// ============================================================

export interface AriaAttributes {
  [key: `aria-${string}`]: string | number | boolean | undefined
}

// ============================================================
// HTML 通用属性（无宽索引签名 —— 自定义属性请用 data-*）
// ============================================================

export interface HTMLAttributes extends AriaAttributes, DOMAttributes {
  children?: VNodeChildren
  key?: string | number | null
  ref?: any
  /**
   * scoped 标记 prop（@actview/plugin-scoped）：值为 scoped 属性名
   * （如 "data-v-abc12345"，可空格分隔多个）。组件元素由插件自动注入，
   * 子组件在 props 声明后手动应用到根元素，运行时翻译为真实属性。
   */
  scopedId?: string
  id?: string
  class?: string
  className?: string
  style?: string | Record<string, string | number>
  title?: string
  // 全局属性
  dir?: string
  lang?: string
  hidden?: boolean
  draggable?: boolean | 'true' | 'false'
  tabIndex?: number
  /** 小写别名（HTML 属性名；运行时 setProp 按 attribute 原样设置） */
  tabindex?: number | string
  accessKey?: string
  contentEditable?: boolean | 'true' | 'false' | 'plaintext-only'
  spellCheck?: boolean
  /** 全局属性 autocapitalize（HTML 小写） */
  autocapitalize?: string
  /** Safari 私有属性（HTML 小写） */
  autocorrect?: string
  /** 虚拟键盘动作提示（HTML 小写属性） */
  enterkeyhint?: string
  /** 小写别名（HTML 属性名） */
  spellcheck?: boolean | string
  role?: string
  slot?: string
  translate?: 'yes' | 'no'
  [key: `data-${string}`]: unknown
}

// ============================================================
// 各元素专属属性
// ============================================================

export interface AnchorHTMLAttributes extends HTMLAttributes {
  href?: string
  target?: string
  download?: string
  rel?: string
  hreflang?: string
  referrerPolicy?: string
}

export interface ImgHTMLAttributes extends HTMLAttributes {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  loading?: 'eager' | 'lazy'
  decoding?: 'async' | 'sync' | 'auto'
  srcSet?: string
}

export interface InputHTMLAttributes extends HTMLAttributes {
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
  disabled?: boolean
  placeholder?: string
  readonly?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  accept?: string
  multiple?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  minLength?: number
  maxLength?: number
  autoFocus?: boolean
  autoComplete?: string
  /** 小写别名（HTML 属性名） */
  autocomplete?: string
  pattern?: string
  size?: number
  /** 表单关联属性（<input form="..."> 合法） */
  form?: string
}

export interface TextareaHTMLAttributes extends HTMLAttributes {
  value?: string
  rows?: number
  cols?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
  maxLength?: number
  minLength?: number
  autoFocus?: boolean
  wrap?: string
  /** 表单关联属性（<textarea form="..."> 合法） */
  form?: string
}

export interface SelectHTMLAttributes extends HTMLAttributes {
  value?: string | readonly string[]
  multiple?: boolean
  disabled?: boolean
  required?: boolean
  name?: string
  size?: number
  autoFocus?: boolean
  /** 表单关联属性（<select form="..."> 合法） */
  form?: string
}

export interface OptionHTMLAttributes extends HTMLAttributes {
  value?: string | number
  selected?: boolean
  disabled?: boolean
  label?: string
}

export interface ButtonHTMLAttributes extends HTMLAttributes {
  type?: 'submit' | 'reset' | 'button'
  disabled?: boolean
  name?: string
  value?: string
  autoFocus?: boolean
  // 表单关联属性（对齐 React ButtonHTMLAttributes：<button form="..."> 合法）
  form?: string
  formAction?: string
  formEncType?: string
  formMethod?: string
  formNoValidate?: boolean
  formTarget?: string
  // Popover API（现代按钮属性）
  popoverTarget?: string
  popoverTargetAction?: 'toggle' | 'show' | 'hide'
}

export interface FormHTMLAttributes extends HTMLAttributes {
  action?: string
  method?: 'get' | 'post'
  target?: string
  noValidate?: boolean
  encType?: string
  name?: string
}

export interface LabelHTMLAttributes extends HTMLAttributes {
  htmlFor?: string
  /** 小写别名（HTML 属性名） */
  for?: string
  form?: string
}

export interface MediaHTMLAttributes extends HTMLAttributes {
  src?: string
  controls?: boolean
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  poster?: string
  crossOrigin?: string
}

export interface TableHTMLAttributes extends HTMLAttributes {
  colSpan?: number
  rowSpan?: number
  headers?: string
  scope?: string
  cellPadding?: number | string
  cellSpacing?: number | string
}

export interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: string
  content?: string
  httpEquiv?: string
  name?: string
}

export interface LinkHTMLAttributes extends HTMLAttributes {
  href?: string
  rel?: string
  type?: string
  media?: string
  as?: string
  crossOrigin?: string
  integrity?: string
}

export interface IframeHTMLAttributes extends HTMLAttributes {
  src?: string
  name?: string
  width?: number | string
  height?: number | string
  allow?: string
  allowFullScreen?: boolean
  loading?: 'eager' | 'lazy'
  sandbox?: string
  title?: string
}

export interface AreaHTMLAttributes extends HTMLAttributes {
  href?: string
  target?: string
  alt?: string
  coords?: string
  shape?: string
  rel?: string
  download?: string
}

export interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean
  start?: number
  type?: string
}

export interface ProgressHTMLAttributes extends HTMLAttributes {
  value?: number
  max?: number
}

export interface MeterHTMLAttributes extends HTMLAttributes {
  value?: number
  min?: number
  max?: number
  low?: number
  high?: number
  optimum?: number
}

export interface TimeHTMLAttributes extends HTMLAttributes {
  dateTime?: string
  /** 小写别名（HTML 属性名） */
  datetime?: string
}

export interface DelHTMLAttributes extends HTMLAttributes {
  cite?: string
  dateTime?: string
}

export interface InsHTMLAttributes extends HTMLAttributes {
  cite?: string
  dateTime?: string
}

export interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string
}

export interface QuoteHTMLAttributes extends HTMLAttributes {
  cite?: string
}

// ============================================================
// SVG 属性
// ============================================================

export interface SVGAttributes extends AriaAttributes, DOMAttributes {
  children?: VNodeChildren
  /** scoped 标记 prop（@actview/plugin-scoped），语义见 HTMLAttributes.scopedId */
  scopedId?: string
  viewBox?: string
  fill?: string
  stroke?: string
  strokeWidth?: number | string
  strokeLinecap?: string
  strokeLinejoin?: string
  strokeDasharray?: string
  fillOpacity?: number | string
  strokeOpacity?: number | string
  d?: string
  cx?: number | string
  cy?: number | string
  r?: number | string
  rx?: number | string
  ry?: number | string
  x?: number | string
  y?: number | string
  x1?: number | string
  y1?: number | string
  x2?: number | string
  y2?: number | string
  width?: number | string
  height?: number | string
  points?: string
  transform?: string
  opacity?: number | string
  clipPath?: string
  clipRule?: string
  fillRule?: string
  strokeMiterlimit?: number | string
  preserveAspectRatio?: string
  href?: string
  xlinkHref?: string
  gradientUnits?: string
  gradientTransform?: string
  offset?: number | string
  stopColor?: string
  stopOpacity?: number | string
  markerUnits?: string
  maskUnits?: string
  maskContentUnits?: string
  pathLength?: number | string
  path?: string
  [key: `data-${string}`]: unknown
}
