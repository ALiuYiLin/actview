// ============================================================
// @actview/jsx — JSX 全局类型增强
// 通过 declare global 注入 JSX 命名空间，
// 让 TypeScript 对所有 .tsx 中的 JSX 元素提供 onXxx 代码提示。
// ============================================================
// 此文件被 index.ts 导入，因此只要项目中 import 了
// @actview/jsx（或通过 jsxImportSource 间接引用）就会生效。
// ============================================================

/* eslint-disable @typescript-eslint/no-namespace */

declare global {
  namespace JSX {
    // 不定义 Element，JSX 表达式类型 fallback 为 any。
    // 组件返回类型校验被绕过，兼容 () => () => VNode 模式。
    // VNode 类型安全由 jsx() 的返回类型和组件显式标注保证。

    interface IntrinsicElements {
      div: Attrs
      span: Attrs
      p: Attrs
      h1: Attrs
      h2: Attrs
      h3: Attrs
      h4: Attrs
      h5: Attrs
      h6: Attrs
      a: Attrs
      button: Attrs
      form: Attrs
      label: Attrs
      ul: Attrs
      ol: Attrs
      li: Attrs
      table: Attrs
      thead: Attrs
      tbody: Attrs
      tr: Attrs
      td: Attrs
      th: Attrs
      strong: Attrs
      em: Attrs
      b: Attrs
      i: Attrs
      u: Attrs
      small: Attrs
      code: Attrs
      pre: Attrs
      blockquote: Attrs
      section: Attrs
      article: Attrs
      nav: Attrs
      header: Attrs
      footer: Attrs
      main: Attrs
      aside: Attrs
      figure: Attrs
      figcaption: Attrs
      img: Attrs
      svg: Attrs
      video: Attrs
      audio: Attrs
      canvas: Attrs
      iframe: Attrs
      br: Attrs
      hr: Attrs
      style: Attrs
      link: Attrs
      meta: Attrs
      slot: Attrs
      details: Attrs
      summary: Attrs
      dialog: Attrs
      menu: Attrs
      progress: Attrs
      time: Attrs
      mark: Attrs
      del: Attrs
      ins: Attrs
      sub: Attrs
      sup: Attrs
      textarea: Attrs
      select: Attrs
      input: InputAttrs
      [tag: string]: Attrs
    }

    interface ElementChildrenAttribute {
      children: unknown
    }
  }
}

// ============================================================
// 属性类型定义
// ============================================================

interface Attrs {
  // ---------- 标准 HTML 属性 ----------
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
  inert?: boolean
  role?: string
  href?: string
  src?: string
  alt?: string
  width?: string | number
  height?: string | number
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  placeholder?: string
  name?: string
  value?: string | number | readonly string[]
  type?: string
  checked?: boolean
  autocomplete?: string
  autofocus?: boolean
  accept?: string
  multiple?: boolean
  pattern?: string
  min?: number | string
  max?: number | string
  step?: number | string
  minlength?: number
  maxlength?: number
  size?: number
  target?: string
  rel?: string
  download?: string
  cols?: number
  rows?: number
  for?: string
  muted?: boolean
  autoplay?: boolean
  controls?: boolean
  loop?: boolean
  poster?: string
  preload?: string
  playsinline?: boolean
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
  fetchpriority?: 'high' | 'low' | 'auto'

  // ---------- 事件处理器 ----------
  onclick?: (e: MouseEvent) => void
  ondblclick?: (e: MouseEvent) => void
  onmousedown?: (e: MouseEvent) => void
  onmouseup?: (e: MouseEvent) => void
  onmousemove?: (e: MouseEvent) => void
  onmouseenter?: (e: MouseEvent) => void
  onmouseleave?: (e: MouseEvent) => void
  onmouseover?: (e: MouseEvent) => void
  onmouseout?: (e: MouseEvent) => void
  onfocus?: (e: FocusEvent) => void
  onblur?: (e: FocusEvent) => void
  onkeydown?: (e: KeyboardEvent) => void
  onkeyup?: (e: KeyboardEvent) => void
  onkeypress?: (e: KeyboardEvent) => void
  onchange?: (e: Event) => void
  oninput?: (e: Event) => void
  onsubmit?: (e: SubmitEvent) => void
  onreset?: (e: Event) => void
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
  onpointercancel?: (e: PointerEvent) => void
  ontouchstart?: (e: TouchEvent) => void
  ontouchend?: (e: TouchEvent) => void
  ontouchmove?: (e: TouchEvent) => void
  ontouchcancel?: (e: TouchEvent) => void
  ontransitionend?: (e: TransitionEvent) => void
  onanimationend?: (e: AnimationEvent) => void
  onanimationiteration?: (e: AnimationEvent) => void
  onanimationstart?: (e: AnimationEvent) => void
  onpaste?: (e: ClipboardEvent) => void
  oncopy?: (e: ClipboardEvent) => void
  oncut?: (e: ClipboardEvent) => void
  oncontextmenu?: (e: MouseEvent) => void
  ondrag?: (e: DragEvent) => void
  ondragstart?: (e: DragEvent) => void
  ondragend?: (e: DragEvent) => void
  ondragover?: (e: DragEvent) => void
  ondragenter?: (e: DragEvent) => void
  ondragleave?: (e: DragEvent) => void
  ondrop?: (e: DragEvent) => void
  onplay?: (e: Event) => void
  onpause?: (e: Event) => void
  onended?: (e: Event) => void
  onvolumechange?: (e: Event) => void
  onwaiting?: (e: Event) => void
  onseeking?: (e: Event) => void
  onseeked?: (e: Event) => void
  onratechange?: (e: Event) => void
  ondurationchange?: (e: Event) => void
  onstalled?: (e: Event) => void
  onsuspend?: (e: Event) => void
  onemptied?: (e: Event) => void
  onfocusin?: (e: FocusEvent) => void
  onfocusout?: (e: FocusEvent) => void
  onselect?: (e: Event) => void
  onsearch?: (e: Event) => void
  oncuechange?: (e: Event) => void
  onformdata?: (e: Event) => void
  oninvalid?: (e: Event) => void

  [key: `data-${string}`]: unknown
  [key: string]: unknown
}

interface InputAttrs extends Attrs {
  type?:
    | 'text' | 'password' | 'email' | 'number' | 'checkbox'
    | 'radio' | 'file' | 'submit' | 'reset' | 'button'
    | 'range' | 'date' | 'time' | 'color' | 'hidden'
    | 'search' | 'tel' | 'url' | 'month' | 'week'
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

// 必须有 export 使文件成为模块，declare global 才会生效
export {}
