// ============================================================
// VNode 类型定义 — React 风格的虚拟 DOM 元素
// ============================================================

/** Fragment 标记 */
export const Fragment: unique symbol = Symbol.for('react.fragment');

/** VNode 的 type 字段允许的类型 */
export type VNodeTypes = string | symbol | ((props: any) => any);

/** VNode 的可序列化 key */
export type VNodeKey = string | number | null;

/** VNode 子节点基础单元 */
export type VNodeChild = VNode | string | number | boolean | null | undefined;
/** VNode 子节点 — 单个或数组 */
export type VNodeChildren = VNodeChild | VNodeChild[];

// ============================================================
// VNode 描述对象（React 18/19 风格）
// ============================================================
export interface VNode<Type = VNodeTypes> {
  $$typeof: symbol;
  type: Type;
  key: VNodeKey;
  ref: any;
  props: Record<string, any> | null;
  _owner?: any;
  /** 指向真实 DOM（渲染后挂载） */
  el?: Node | null;
}

/** Lazy VNode — JSX 表达式实际返回的函数类型 */
export type LazyVNode = () => VNode;

// ============================================================
// 属性类型 — 用于 JSX.IntrinsicElements
// ============================================================

/** 表单事件 — target 上带 value/checked 等输入属性 */
export interface FormEvent extends Event {
  target: EventTarget & {
    value: string;
    checked: boolean;
  };
}

/** 通用 HTML 元素属性 */
export interface HtmlProps {
  id?: string;
  class?: string;
  className?: string;
  style?: string | Record<string, string | number>;
  title?: string;
  lang?: string;
  dir?: string;
  hidden?: boolean;
  tabindex?: number;
  role?: string;
  href?: string;
  src?: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  placeholder?: string;
  name?: string;
  value?: string | number | readonly string[];
  type?: string;
  checked?: boolean;
  autocomplete?: string;
  autofocus?: boolean;
  multiple?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  minlength?: number;
  maxlength?: number;
  size?: number;
  target?: string;
  rel?: string;
  download?: string;
  muted?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchpriority?: 'high' | 'low' | 'auto';

  // 事件处理器
  // 表单事件用 FormEvent —— target 上带有 value/checked 属性
  onclick?: (e: MouseEvent) => void;
  ondblclick?: (e: MouseEvent) => void;
  onmousedown?: (e: MouseEvent) => void;
  onmouseup?: (e: MouseEvent) => void;
  onmousemove?: (e: MouseEvent) => void;
  onmouseenter?: (e: MouseEvent) => void;
  onmouseleave?: (e: MouseEvent) => void;
  onmouseover?: (e: MouseEvent) => void;
  onmouseout?: (e: MouseEvent) => void;
  onfocus?: (e: FocusEvent) => void;
  onblur?: (e: FocusEvent) => void;
  onkeydown?: (e: KeyboardEvent) => void;
  onkeyup?: (e: KeyboardEvent) => void;
  onkeypress?: (e: KeyboardEvent) => void;
  onchange?: (e: FormEvent) => void;
  oninput?: (e: FormEvent) => void;
  onsubmit?: (e: FormEvent) => void;
  onscroll?: (e: Event) => void;
  onwheel?: (e: WheelEvent) => void;
  onload?: (e: Event) => void;
  onerror?: (e: Event | string) => void;
  onpointerdown?: (e: PointerEvent) => void;
  onpointerup?: (e: PointerEvent) => void;
  onpointermove?: (e: PointerEvent) => void;
  onpointerenter?: (e: PointerEvent) => void;
  onpointerleave?: (e: PointerEvent) => void;
  ontouchstart?: (e: TouchEvent) => void;
  ontouchend?: (e: TouchEvent) => void;
  ontouchmove?: (e: TouchEvent) => void;
  ontransitionend?: (e: TransitionEvent) => void;
  onanimationend?: (e: AnimationEvent) => void;
  onpaste?: (e: ClipboardEvent) => void;
  oncopy?: (e: ClipboardEvent) => void;
  oncut?: (e: ClipboardEvent) => void;
  oncontextmenu?: (e: MouseEvent) => void;
  ondrag?: (e: DragEvent) => void;
  ondragstart?: (e: DragEvent) => void;
  ondragend?: (e: DragEvent) => void;
  ondragover?: (e: DragEvent) => void;
  ondragenter?: (e: DragEvent) => void;
  ondragleave?: (e: DragEvent) => void;
  ondrop?: (e: DragEvent) => void;
  onplay?: (e: Event) => void;
  onpause?: (e: Event) => void;
  onended?: (e: Event) => void;
  onvolumechange?: (e: Event) => void;
  onwaiting?: (e: Event) => void;
  onseeking?: (e: Event) => void;
  onseeked?: (e: Event) => void;
  onselect?: (e: FormEvent) => void;
  oninvalid?: (e: FormEvent) => void;

  [key: `data-${string}`]: unknown;
  [key: string]: unknown;
}

/** input 元素特有属性 */
export interface InputProps extends HtmlProps {
  type?:
    | 'text' | 'password' | 'email' | 'number' | 'checkbox'
    | 'radio' | 'file' | 'submit' | 'reset' | 'button'
    | 'range' | 'date' | 'time' | 'color' | 'hidden'
    | 'search' | 'tel' | 'url' | 'month' | 'week'
    | 'datetime-local';
  value?: string | number | readonly string[];
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  checked?: boolean;
  name?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autocomplete?: string;
  autofocus?: boolean;
  accept?: string;
  multiple?: boolean;
  pattern?: string;
  minlength?: number;
  maxlength?: number;
  size?: number;
  src?: string;
  alt?: string;
  list?: string;
}
