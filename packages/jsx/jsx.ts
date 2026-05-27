/**
 * JSX 工厂函数 — 生成虚拟 Element 描述符对象（类似 React Element）
 *
 * createElement / jsx / jsxs / jsxDEV 均不操作真实 DOM，
 * 只返回描述结构的普通对象 { $$typeof, type, props, key }。
 * Fragment 返回 type 为 ACTVIEW_FRAGMENT 的 descriptor。
 */

/** 用于标记内部 VElement 对象的 Symbol */
export const ACTVIEW_ELEMENT = Symbol.for('actview.element');
/** Fragment 类型标记 */
export const ACTVIEW_FRAGMENT = Symbol.for('actview.fragment');

// ======== 类型定义 ========

/** 虚拟 Element 描述符 */
export interface VElement {
  $$typeof: typeof ACTVIEW_ELEMENT;
  type: VType;
  props: Record<string, any>;
  key: string | null;
}

export type VType =
  | string
  | symbol
  | ((props: any) => any);

// ======== JSX 命名空间（供 tsconfig jsx 类型推导使用） ========

export namespace JSX {
  export type Element = VElement;
  export type ElementType = VType;

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

// ======== 工厂函数 ========

function createDescriptor(
  type: VType,
  props: Record<string, any> | null,
  key: string | null,
): VElement {
  return {
    $$typeof: ACTVIEW_ELEMENT,
    type,
    props: props ?? {},
    key,
  };
}

/**
 * 标准 JSX 工厂（可自动转换标签函数执行）
 *
 * 注意：createElement 仍然会原地执行函数组件（以保持与现有 setup 模式的兼容），
 * 但返回的是 VElement 描述符而非真实 DOM。
 */
export function createElement(
  type: VType,
  props: Record<string, any> | null,
  ...children: any[]
): VElement | VElement[] {
  // 从 props 中提取 children（jsxDEV 模式会把 children 放在 props 里）
  const propsChildren = props?.children;
  const allChildren =
    children.length > 0
      ? children
      : propsChildren != null
        ? Array.isArray(propsChildren)
          ? propsChildren
          : [propsChildren]
        : [];

  // 提取 key
  let key: string | null = null;
  if (props && props.key !== undefined) {
    key = String(props.key);
  }

  const mergedProps = { ...props };

  // 函数组件
  if (typeof type === 'function') {
    const defaultChildren: any[] = [];
    for (const child of allChildren) {
      defaultChildren.push(child);
    }
    mergedProps.children = defaultChildren;
    // 执行组件函数，递归展开
    const result = type(mergedProps);
    return result;
  }

  // 字符串标签（HTML/SVG 元素）
  mergedProps.children = allChildren;
  // 清理不应出现在 props 中的内部字段
  delete mergedProps.key;

  return createDescriptor(type, mergedProps, key);
}

/**
 * jsxDEV — 开发模式 JSX 工厂
 * 签名: jsxDEV(type, props, key, isStaticChildren, source, self)
 */
export function jsxDEV(
  type: VType,
  props: Record<string, any> | null,
  key?: string,
  _isStaticChildren?: boolean,
  _source?: any,
  _self?: any,
): VElement | VElement[] {
  if (type === Fragment) {
    return createDescriptor(ACTVIEW_FRAGMENT, props ?? {}, key ?? null);
  }

  // jsxDEV 模式下 key 是独立参数
  const mergedProps = { ...props };

  if (typeof type === 'function') {
    mergedProps.children = [];
    const result = type(mergedProps);
    return result;
  }

  return createDescriptor(type, mergedProps, key ?? null);
}

/**
 * Fragment 组件
 */
export function Fragment(props: { children?: any; key?: any }): VElement {
  return createDescriptor(
    ACTVIEW_FRAGMENT,
    { ...props },
    props?.key != null ? String(props.key) : null,
  );
}

/**
 * react-jsx transform 的 jsx/jsxs 函数
 * 签名: jsx(type, props, key)
 * children 在 props.children 中（非展开参数），key 是独立参数
 */
export function jsx(
  type: VType,
  props: Record<string, any> | null,
  key?: any,
): VElement | VElement[] {
  if (type === Fragment) {
    return createDescriptor(ACTVIEW_FRAGMENT, props ?? {}, key ?? null);
  }

  const mergedProps = { ...props };

  if (typeof type === 'function') {
    mergedProps.children = [];
    const result = type(mergedProps);
    return result;
  }

  return createDescriptor(type, mergedProps, key ?? null);
}

export const jsxs = jsx;

