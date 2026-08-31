// ============================================================
// JSX 属性类型（v2）— 从 v1 @actview/jsx/types.ts 提取的属性类型部分
// React 语义：className / htmlFor / onChange（onChange→onInput 由
// @actview/plugin-jsx 编译期映射）等；纯类型、无运行时依赖。
// ============================================================
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
  /** passive 修饰符（actview 事件系统小写后缀解析） */
  onScrollPassive?: EventHandler<Event>
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

/**
 * class 值（运行时 normalizeClass 语义，对齐 Vue）：
 *   字符串原样；数组递归展平；对象取 truthy 键；null/undefined/false 跳过。
 *  class / className 属性统一接受该形态。
 */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, any>

/** children 类型（v2：vue VNode / 文本 / 数组；宽松放行） */
export type VNodeChildren = any

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
  class?: ClassValue
  className?: ClassValue
  style?: string | Record<string, string | number | undefined>
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
  // ---- 对齐 React HTMLAttributes 补全 ----
  /** 移动端虚拟键盘类型提示（Living Standard） */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
  /** CSP nonce */
  nonce?: string
  /** 指定自定义内置元素（Living Standard） */
  is?: string
  /** 惰性元素（现代属性） */
  inert?: boolean
  /** 旧版 contextmenu */
  contextMenu?: string
  radioGroup?: string
  /** 驼峰标准名（React 命名；小写 autocapitalize 历史兼容） */
  autoCapitalize?: string
  autoCorrect?: string
  enterKeyHint?: string
  autoSave?: string
  // microdata
  itemID?: string
  itemProp?: string
  itemRef?: string
  itemScope?: boolean
  itemType?: string
  // RDFa
  about?: string
  datatype?: string
  inlist?: any
  prefix?: string
  property?: string
  resource?: string
  'typeof'?: string
  vocab?: string
  // 非标准
  color?: string
  results?: number
  security?: string
  unselectable?: 'on' | 'off'
  // 杂项
  wmode?: string
  profile?: string
  icon?: string
  mediaGroup?: string
  manifest?: string
  credentialless?: boolean
  /** React 语义：dangerouslySetInnerHTML（渲染层 setProp 透传） */
  dangerouslySetInnerHTML?: {__html: string}
  [key: `data-${string}`]: unknown
}

// ============================================================
// 各元素专属属性
// ============================================================

export interface AnchorHTMLAttributes extends HTMLAttributes {
  href?: string
  target?: string
  /** overloaded 布尔：true→裸属性、false→移除、字符串→值（对齐 React） */
  download?: string | boolean
  rel?: string
  hreflang?: string
  /** 驼峰标准名（React 命名；hreflang 小写历史兼容） */
  hrefLang?: string
  referrerPolicy?: string
  type?: string
  ping?: string
}

export interface ImgHTMLAttributes extends HTMLAttributes {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  loading?: 'eager' | 'lazy'
  decoding?: 'async' | 'sync' | 'auto'
  srcSet?: string
  crossOrigin?: string
  referrerPolicy?: string
  sizes?: string
  useMap?: string
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
  /** React 语义：defaultChecked 走 property（非受控默认选中，对齐 React InputHTMLAttributes） */
  defaultChecked?: boolean
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
  /** React 语义：defaultValue 走 property（PD-23） */
  defaultValue?: string | number | readonly string[]
  /** type=image 的资源地址 */
  src?: string
  /** type=image 的替代文本 */
  alt?: string
  /** type=image 的渲染尺寸 */
  height?: number | string
  width?: number | string
  /** 移动端媒体捕获（https://www.w3.org/TR/html-media-capture/） */
  capture?: boolean | 'user' | 'environment'
  /** 关联 <datalist> 的 id */
  list?: string
  /** form* 覆盖属性（对齐 React InputHTMLAttributes） */
  formAction?: string
  formEncType?: string
  formMethod?: string
  formNoValidate?: boolean
  formTarget?: string
  /** 跨域策略（type=image / CORS 场景） */
  crossOrigin?: string
  /** 表单控件方向性（dir=auto 场景，Living Standard） */
  dirName?: string
  /** 虚拟键盘动作提示（驼峰标准名） */
  enterKeyHint?: string
}

export interface TextareaHTMLAttributes extends HTMLAttributes {
  value?: string
  rows?: number
  cols?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  maxLength?: number
  minLength?: number
  autoFocus?: boolean
  autoComplete?: string
  wrap?: string
  dirName?: string
  /** React 语义：defaultValue 走 property（非受控默认值） */
  defaultValue?: string
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
  autoComplete?: string
  /** React 语义：defaultValue 走 property（非受控默认值） */
  defaultValue?: string | readonly string[]
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
  /** React 语义：acceptCharset（HTML 属性 accept-charset） */
  acceptCharset?: string
  name?: string
  autoComplete?: string
  rel?: string
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
  /** 媒体控件列表（现代属性） */
  controlsList?: string
  /** 画中画禁用 */
  disablePictureInPicture?: boolean
  /** 远程播放禁用 */
  disableRemotePlayback?: boolean
  /** 内联播放（iOS 全屏抑制） */
  playsInline?: boolean
}

export interface TableHTMLAttributes extends HTMLAttributes {
  colSpan?: number
  rowSpan?: number
  headers?: string
  scope?: string
  cellPadding?: number | string
  cellSpacing?: number | string
  summary?: string
}

export interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: string
  content?: string
  httpEquiv?: string
  name?: string
  media?: string
}

export interface LinkHTMLAttributes extends HTMLAttributes {
  href?: string
  rel?: string
  type?: string
  media?: string
  as?: string
  crossOrigin?: string
  integrity?: string
  disabled?: boolean
  /** 资源加载优先级（现代属性） */
  fetchPriority?: 'high' | 'low' | 'auto'
  /** 驼峰标准名 */
  hrefLang?: string
  imageSizes?: string
  imageSrcSet?: string
  referrerPolicy?: string
  sizes?: string
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
  /** 旧式透明背景 */
  allowTransparency?: boolean
  frameBorder?: number | string
  marginHeight?: number
  marginWidth?: number
  referrerPolicy?: string
  scrolling?: string
  /** 旧式无缝嵌入（已废弃但仍有类型） */
  seamless?: boolean
  /** 内联文档（srcdoc） */
  srcDoc?: string
}

export interface AreaHTMLAttributes extends HTMLAttributes {
  href?: string
  target?: string
  alt?: string
  coords?: string
  shape?: string
  rel?: string
  /** overloaded 布尔：true→裸属性、false→移除、字符串→值（对齐 React） */
  download?: string | boolean
  /** 驼峰标准名 */
  hrefLang?: string
  type?: string
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
  /** 表单关联属性（<meter form="..."> 合法） */
  form?: string
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
// 补齐无专属声明的元素（对齐 React HTMLAttributes 家族）
// ============================================================

export interface DialogHTMLAttributes extends HTMLAttributes {
  open?: boolean
  /** 对话框关闭请求（Esc） */
  onCancel?: EventHandler<Event>
  /** 对话框关闭后 */
  onClose?: EventHandler<Event>
}

export interface DetailsHTMLAttributes extends HTMLAttributes {
  open?: boolean
  /** 折叠状态切换 */
  onToggle?: EventHandler<Event>
}

export interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean
  charSet?: string
  crossOrigin?: string
  defer?: boolean
  integrity?: string
  /** ES 模块旁路（经典脚本） */
  noModule?: boolean
  referrerPolicy?: string
  src?: string
  type?: string
}

export interface ObjectHTMLAttributes extends HTMLAttributes {
  classID?: string
  data?: string
  form?: string
  height?: number | string
  name?: string
  type?: string
  useMap?: string
  width?: number | string
}

export interface ColHTMLAttributes extends HTMLAttributes {
  span?: number
  width?: number | string
}

export interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean
  kind?: string
  label?: string
  src?: string
  srcLang?: string
}

export interface SourceHTMLAttributes extends HTMLAttributes {
  height?: number | string
  media?: string
  sizes?: string
  src?: string
  srcSet?: string
  type?: string
  width?: number | string
}

export interface StyleHTMLAttributes extends HTMLAttributes {
  media?: string
  nonce?: string
  scoped?: boolean
  type?: string
}

export interface HtmlHTMLAttributes extends HTMLAttributes {
  manifest?: string
}

export interface DataHTMLAttributes extends HTMLAttributes {
  value?: string | number | readonly string[]
}

export interface LiHTMLAttributes extends HTMLAttributes {
  value?: number | string
}

export interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean
  label?: string
}

export interface OutputHTMLAttributes extends HTMLAttributes {
  form?: string
  htmlFor?: string
  name?: string
}

export interface ParamHTMLAttributes extends HTMLAttributes {
  name?: string
  value?: string | number | readonly string[]
}

export interface MapHTMLAttributes extends HTMLAttributes {
  name?: string
}

export interface MenuHTMLAttributes extends HTMLAttributes {
  type?: string
}

// ============================================================
// SVG 属性
// ============================================================

export interface SVGAttributes extends AriaAttributes, DOMAttributes {
  children?: VNodeChildren
  /** scoped 标记 prop（@actview/plugin-scoped），语义见 HTMLAttributes.scopedId */
  scopedId?: string
  /** SVG 元素同样接受 class（className 别名语义） */
  class?: ClassValue
  id?: string
  lang?: string
  style?: string | Record<string, string | number | undefined>
  // ---- 几何 / 坐标 ----
  viewBox?: string
  d?: string
  path?: string
  points?: string
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
  dx?: number | string
  dy?: number | string
  fx?: number | string
  fy?: number | string
  width?: number | string
  height?: number | string
  refX?: number | string
  refY?: number | string
  targetX?: number | string
  targetY?: number | string
  pointsAtX?: number | string
  pointsAtY?: number | string
  pointsAtZ?: number | string
  // ---- 数值参数 ----
  opacity?: number | string
  fillOpacity?: number | string
  strokeOpacity?: number | string
  floodOpacity?: number | string
  stopOpacity?: number | string
  strokeWidth?: number | string
  strokeMiterlimit?: number | string
  xHeight?: number | string
  capHeight?: number | string
  accentHeight?: number | string
  ascent?: number | string
  descent?: number | string
  unitsPerEm?: number | string
  stemh?: number | string
  stemv?: number | string
  horizAdvX?: number | string
  horizOriginX?: number | string
  vertAdvY?: number | string
  vertOriginX?: number | string
  vertOriginY?: number | string
  u1?: number | string
  u2?: number | string
  k?: number | string
  k1?: number | string
  k2?: number | string
  k3?: number | string
  k4?: number | string
  rotate?: number | string
  scale?: number | string
  numOctaves?: number | string
  stdDeviation?: number | string
  amplitude?: number | string
  exponent?: number | string
  slope?: number | string
  intercept?: number | string
  surfaceScale?: number | string
  diffuseConstant?: number | string
  specularConstant?: number | string
  specularExponent?: number | string
  offset?: number | string
  startOffset?: number | string
  tableValues?: string
  z?: number | string
  // ---- 描边 / 填充 / 绘制 ----
  fill?: string
  stroke?: string
  strokeLinecap?: string
  strokeLinejoin?: string
  strokeDasharray?: string
  strokeDashoffset?: string
  fillRule?: string
  clipPath?: string
  clipRule?: string
  clipPathUnits?: string
  transform?: string
  transformOrigin?: string
  preserveAspectRatio?: string
  mask?: string
  maskUnits?: string
  maskContentUnits?: string
  maskType?: string
  // ---- 渐变 / 滤镜 ----
  gradientUnits?: string
  gradientTransform?: string
  spreadMethod?: string
  stopColor?: string
  floodColor?: string
  lightingColor?: string
  colorInterpolation?: string
  colorInterpolationFilters?: string
  colorProfile?: string
  colorRendering?: string
  filter?: string
  filterRes?: string
  filterUnits?: string
  primitiveUnits?: string
  in?: string
  in2?: string
  result?: string
  mode?: string
  operator?: string
  edgeMode?: string
  divisor?: number | string
  kernelMatrix?: string
  kernelUnitLength?: string
  seed?: number | string
  // ---- 图案 / 标记 ----
  patternUnits?: string
  patternContentUnits?: string
  patternTransform?: string
  markerEnd?: string
  markerHeight?: number | string
  markerMid?: string
  markerStart?: string
  markerWidth?: number | string
  markerUnits?: string
  // ---- 字体 / 文本 ----
  fontFamily?: string
  fontSize?: number | string
  fontSizeAdjust?: string
  fontStretch?: string
  fontStyle?: string
  fontVariant?: string
  fontWeight?: string
  glyphName?: string
  glyphOrientationHorizontal?: string
  glyphOrientationVertical?: string
  glyphRef?: string
  arabicForm?: string
  mathematical?: string
  vAlphabetic?: string
  vHanging?: string
  vIdeographic?: string
  vMathematical?: string
  overlinePosition?: string
  overlineThickness?: string
  underlinePosition?: string
  underlineThickness?: string
  strikethroughPosition?: string
  strikethroughThickness?: string
  textAnchor?: string
  textDecoration?: string
  textLength?: number | string
  textRendering?: string
  letterSpacing?: string
  wordSpacing?: string
  writingMode?: string
  direction?: string
  unicode?: string
  unicodeBidi?: string
  unicodeRange?: string
  // ---- 渲染 ----
  pointerEvents?: string
  shapeRendering?: string
  imageRendering?: string
  vectorEffect?: string
  paintOrder?: string
  display?: string
  visibility?: string
  overflow?: string
  cursor?: string
  clip?: string
  enableBackground?: string
  renderingIntent?: string
  // ---- 动画 ----
  begin?: string
  dur?: string
  end?: string
  repeatCount?: string
  repeatDur?: string
  restart?: string
  calcMode?: string
  keyTimes?: string
  keySplines?: string
  keyPoints?: string
  from?: string
  to?: string
  by?: string
  values?: string
  accumulate?: string
  additive?: string
  attributeName?: string
  attributeType?: string
  autoReverse?: boolean | string
  allowReorder?: boolean | string
  externalResourcesRequired?: boolean | string
  preserveAlpha?: boolean | string
  // ---- 元数据 / 通用 ----
  orientation?: string
  origin?: string
  version?: string
  contentScriptType?: string
  contentStyleType?: string
  systemLanguage?: string
  requiredExtensions?: string
  requiredFeatures?: string
  zoomAndPan?: string
  local?: string
  lengthAdjust?: string
  max?: number | string
  min?: number | string
  media?: string
  method?: string
  name?: string
  target?: string
  type?: string
  color?: string
  about?: string
  datatype?: string
  inlist?: any
  prefix?: string
  property?: string
  resource?: string
  'typeof'?: string
  vocab?: string
  results?: number
  security?: string
  unselectable?: 'on' | 'off'
  // ---- xlink / xml ----
  href?: string
  xlinkHref?: string
  xlinkActuate?: string
  xlinkArcrole?: string
  xlinkRole?: string
  xlinkShow?: string
  xlinkTitle?: string
  xlinkType?: string
  xmlBase?: string
  xmlLang?: string
  xmlSpace?: string
  xmlns?: string
  xmlnsXlink?: string
  [key: `data-${string}`]: unknown
}