/**
 * JSX 工厂 — 生成类 Vue 的 VNode 描述对象
 *
 * createElement / jsx / jsxs / jsxDEV 只生成普通 VNode 对象：
 *   { __v_isVNode, type, props, children, key, el }
 *
 * 函数组件不会在工厂中调用（type 保留为函数引用），
 * 由 Fiber Reconciler 在 render 阶段调用。
 */

/** Fragment 类型标记 */
export const ACTVIEW_FRAGMENT = Symbol.for('actview.fragment');

// ======== 类型定义 ========

export type VNodeTypes = string | symbol | ((props: any) => any);

/** VNode — 类似 Vue 的虚拟节点结构 */
export interface VNode<T = any> {
  __v_isVNode: true;
  type: VNodeTypes;
  props: Record<string, any> | null;
  children: VNode[] | string | null;
  key: string | null;
  el: Node | null;
}

export type VType = VNodeTypes;

// ======== JSX 命名空间（供 tsconfig jsx 类型推导使用） ========

export namespace JSX {
  export type Element = VNode;
  export type ElementType = VNodeTypes;
  export type ArrayElement = VNode[];
  export type Child = VNode | string | number | boolean | null | undefined;
  export type Children = Child | Child[];

  export interface IntrinsicElements {
    div: HTMLAttributes;
    span: HTMLAttributes;
    p: HTMLAttributes;
    a: HTMLAttributes & { href?: string; target?: string };
    button: HTMLAttributes & { type?: string; disabled?: boolean };
    input: HTMLAttributes & { type?: string; value?: string; placeholder?: string; disabled?: boolean };
    img: HTMLAttributes & { src?: string; alt?: string };
    ul: HTMLAttributes;
    li: HTMLAttributes;
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    form: HTMLAttributes;
    label: HTMLAttributes & { for?: string };
    textarea: HTMLAttributes & { value?: string; placeholder?: string };
    select: HTMLAttributes;
    option: HTMLAttributes & { value?: string };
    table: HTMLAttributes;
    tr: HTMLAttributes;
    td: HTMLAttributes;
    th: HTMLAttributes;
    thead: HTMLAttributes;
    tbody: HTMLAttributes;
    br: HTMLAttributes;
    hr: HTMLAttributes;
    [elemName: string]: HTMLAttributes;
  }

  export interface HTMLAttributes {
    id?: string;
    class?: string;
    className?: string;
    style?: string | Partial<CSSStyleDeclaration>;
    value?: string | number | readonly string[] | undefined;
    checked?: boolean;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    onClick?: (e: MouseEvent) => void;
    onChange?: (e: Event) => void;
    onInput?: (e: Event) => void;
    onSubmit?: (e: Event) => void;
    children?: any;
    key?: any;
    [key: string]: any;
  }
}

// ======== 工具函数 ========

/** 运行时 VNode 类型守卫 */
export function isVNode(v: any): v is VNode {
  return v != null && typeof v === 'object' && v.__v_isVNode === true;
}

// ======== VNode 工厂 ========

function createVNode(
  type: VNodeTypes,
  props: Record<string, any> | null,
  children: VNode[] | string | null,
  key: string | null,
): VNode {
  return {
    __v_isVNode: true,
    type,
    props: props ?? null,
    children,
    key,
    el: null,
  };
}

/**
 * 标准化 children 数组为 VNode[] | string | null
 *
 * 规则：
 * - null/undefined/boolean 被过滤
 * - 单文本子节点 → string
 * - 多子节点 → VNode[]，文本片段转为 TEXT 类型 VNode
 * - 空 → null
 */
function normalizeChildren(raw: any[]): VNode[] | string | null {
  const flat = raw.flat(Infinity);
  const filtered = flat.filter(c => c != null && typeof c !== 'boolean');

  if (filtered.length === 0) return null;
  if (filtered.length === 1) {
    const c = filtered[0];
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
    if (isVNode(c)) return [c];
    return null;
  }

  // 多子节点：文本转为 TEXT VNode
  return filtered.map(c => {
    if (isVNode(c)) return c;
    if (typeof c === 'string' || typeof c === 'number') {
      return createVNode('TEXT', null, String(c), null);
    }
    return null;
  }).filter(Boolean) as VNode[];
}

// ======== 工厂函数 ========

/**
 * 标准 JSX 工厂（classic transform）
 * 签名：createElement(type, props, ...children)
 */
export function createElement(
  type: VNodeTypes,
  props: Record<string, any> | null,
  ...children: any[]
): VNode {
  let key: string | null = null;
  if (props && props.key !== undefined) {
    key = String(props.key);
  }

  // 从 props.children 或展开参数中提取子节点
  let childNodes: VNode[] | string | null = null;
  if (children.length > 0) {
    childNodes = normalizeChildren(children);
  } else if (props?.children != null) {
    const raw = Array.isArray(props.children) ? props.children : [props.children];
    childNodes = normalizeChildren(raw);
  }

  // 清理 props 中的内部字段
  const cleanedProps = props ? Object.assign({}, props) : null;
  if (cleanedProps) {
    delete cleanedProps.children;
    delete cleanedProps.key;
  }

  return createVNode(type, cleanedProps, childNodes, key);
}

/**
 * jsxDEV — 开发模式 JSX 工厂
 * 签名：jsxDEV(type, props, key, isStaticChildren, source, self)
 */
export function jsxDEV(
  type: VNodeTypes,
  props: Record<string, any> | null,
  key?: string,
  _isStaticChildren?: boolean,
  _source?: any,
  _self?: any,
): VNode {
  if (type === Fragment) {
    return createVNode(ACTVIEW_FRAGMENT, props, null, key ?? null);
  }

  let childNodes: VNode[] | string | null = null;
  if (props?.children != null) {
    const raw = Array.isArray(props.children) ? props.children : [props.children];
    childNodes = normalizeChildren(raw);
  }

  const cleanedProps = props ? Object.assign({}, props) : null;
  if (cleanedProps) {
    delete cleanedProps.children;
    delete cleanedProps.key;
  }

  return createVNode(type, cleanedProps, childNodes, key ?? null);
}

/** Fragment 组件 */
export function Fragment(props: { children?: any; key?: any }): VNode {
  let childNodes: VNode[] | string | null = null;
  if (props?.children != null) {
    const raw = Array.isArray(props.children) ? props.children : [props.children];
    childNodes = normalizeChildren(raw);
  }
  return createVNode(ACTVIEW_FRAGMENT, null, childNodes, props?.key != null ? String(props.key) : null);
}

/**
 * react-jsx transform 的 jsx/jsxs 函数
 * 签名：jsx(type, props, key)
 */
export function jsx(
  type: VNodeTypes,
  props: Record<string, any> | null,
  key?: any,
): VNode {
  if (type === Fragment) {
    return createVNode(ACTVIEW_FRAGMENT, props, null, key != null ? String(key) : null);
  }

  let childNodes: VNode[] | string | null = null;
  if (props?.children != null) {
    const raw = Array.isArray(props.children) ? props.children : [props.children];
    childNodes = normalizeChildren(raw);
  }

  const cleanedProps = props ? Object.assign({}, props) : null;
  if (cleanedProps) {
    delete cleanedProps.children;
    delete cleanedProps.key;
  }

  return createVNode(type, cleanedProps, childNodes, key != null ? String(key) : null);
}

export const jsxs = jsx;
