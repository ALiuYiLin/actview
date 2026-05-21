// 自定义 JSX 工厂函数

import { diffElement, reconcileFragmentChildren } from './diff';

/**
 * 组件级更新函数的 getter/setter
 * 由 @actview/core 的 hooks 模块注入，实现 JSX 层与 core 层的解耦
 */
let _getCurrentUpdateFn: (() => (() => void) | null) | null = null;
let _setCurrentUpdateFn: ((fn: (() => void) | null) => void) | null = null;

/**
 * 注入 currentUpdateFn 的 getter/setter（由 @actview/core 在初始化时调用）
 */
export function injectUpdateFnAccessors(
  getter: () => (() => void) | null,
  setter: (fn: (() => void) | null) => void
) {
  _getCurrentUpdateFn = getter;
  _setCurrentUpdateFn = setter;
}

// ======== 当前组件实例注入 ========

let _getCurrentInstance: (() => any) | null = null;
let _setCurrentInstance: ((inst: any) => void) | null = null;

export function injectCurrentInstanceAccessors(
  getter: () => any,
  setter: (inst: any) => void
) {
  _getCurrentInstance = getter;
  _setCurrentInstance = setter;
}


export namespace JSX {
  export type Element = HTMLElement | SVGElement | Text | DocumentFragment;
  // 支持 setup 模式组件（返回 () => Element）
  export type ElementType =
    | string
    | ((props: any) => Element)
    | ((props: any) => (props: any) => Element);
  


  export interface IntrinsicElements {
    // HTML 元素
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
    
    // 表单属性
    value?: string | number | readonly string[] | undefined;
    checked?: boolean;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    
    // 事件
    onClick?: (e: MouseEvent) => void;
    onChange?: (e: Event) => void;
    onInput?: (e: Event) => void;
    onSubmit?: (e: Event) => void;
    
    children?: any;
    [key: string]: any;
  }
}

type Child = HTMLElement | SVGElement | Text | string | number | boolean | null | undefined | Child[];

type Tag = string | Function;

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set([
  "svg", "path", "circle", "ellipse", "line", "polygon", "polyline", "rect",
  "g", "defs", "use", "symbol", "clipPath", "mask", "pattern", "image",
  "text", "tspan", "textPath", "foreignObject", "marker", "linearGradient",
  "radialGradient", "stop", "filter", "feBlend", "feColorMatrix",
  "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting",
  "feDisplacementMap", "feFlood", "feGaussianBlur", "feImage", "feMerge",
  "feMergeNode", "feMorphology", "feOffset", "feSpecularLighting", "feTile",
  "feTurbulence", "animate", "animateTransform", "set",
]);

/**
 * 自定义 JSX 工厂函数
 * 将 JSX 转换为真实 DOM 元素
 */
export function createElement(
  tag: Tag,
  props: Record<string, any> | null,
  ...children: Child[]
): HTMLElement | SVGElement | DocumentFragment {
  // 从 props 中提取 children（jsxDEV 模式会把 children 放在 props 里）
  const propsChildren = props?.children;
  const allChildren = children.length > 0 ? children : (propsChildren != null ? (Array.isArray(propsChildren) ? propsChildren : [propsChildren]) : []);
  
  // 如果 tag 是函数组件
  if (typeof tag === "function") {
    const mergedProps = { ...props };
    const defaultChildren: Child[] = [];

    for (const child of allChildren) {
      if (child instanceof HTMLTemplateElement && child.getAttribute("slot")) {
        const slotName = child.getAttribute("slot")!;
        const nodes = Array.from(child.childNodes.length ? child.childNodes : child.content.childNodes) as Child[];
        mergedProps[slotName] = nodes;
      } else {
        defaultChildren.push(child);
      }
    }

    mergedProps.children = defaultChildren;
    return mountComponent(tag, mergedProps);
  }

  // 创建 DOM 元素（SVG 元素需要使用命名空间）
  const tagName = tag as string;
  const isSvg = SVG_TAGS.has(tagName);
  const element = isSvg
    ? document.createElementNS(SVG_NS, tagName)
    : document.createElement(tagName);

  // 设置属性
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") {
        continue; // children 单独处理
      } else if (key === "key") {
        // key 不设为 HTML attribute，存到 _key 上供 diff 使用
        (element as any)._key = value;
        continue;
      } else if (key === "className" || key === "class") {
        element.setAttribute("class", value);
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else if (key.startsWith("on") && typeof value === "function") {
        // 事件绑定，如 onClick -> click
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
        // 记录 listener 以便 diff
        (element as any)._listeners = (element as any)._listeners || {};
        (element as any)._listeners[eventName] = value;
      } else if (value === true) {
        element.setAttribute(key, "");
      } else if (value !== false && value != null) {
        element.setAttribute(key, String(value));
      }
    }
  }

  // 添加子元素
  appendChildren(element, allChildren);

  return element;
}

/**
 * jsxDEV 函数 - 开发模式下使用
 * 签名: jsxDEV(tag, props, key, isStaticChildren, source, self)
 */
export function jsxDEV(
  tag: Tag,
  props: Record<string, any> | null,
  _key?: string,
  _isStaticChildren?: boolean,
  _source?: any,
  _self?: any
): HTMLElement | SVGElement | DocumentFragment {
  // 处理 Fragment
  if (tag === Fragment) {
    return Fragment(props || {});
  }
  // jsxDEV 模式下 key 是独立参数，需要合并回 props 供 createElement 处理
  if (_key != null && props) {
    props = { ...props, key: _key };
  } else if (_key != null) {
    props = { key: _key };
  }
  return createElement(tag, props);
}

/**
 * Fragment 支持
 */
export function Fragment(props: { children?: Child | Child[] }): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const children = props?.children;
  if (children != null) {
    const childArray = Array.isArray(children) ? children : [children];
    appendChildren(fragment, childArray);
  }
  return fragment;
}



export type Ref<T> = {
  value: T;
  __isRef: true;
};


/**
 * 组件实例信息，挂载在根 DOM 元素的 _componentInstance 上
 */
interface ComponentInstance {
  /** 组件函数 */
  setupFn: Function;
  /** render 函数（由 setup 返回，或等同于 setupFn） */
  renderFn: Function;
  /** 最新 props */
  props: Record<string, any>;
  /** 组件当前的根 DOM 元素（Element 模式）或 startAnchor（Fragment 模式） */
  el: Node | null;
  /** Fragment 模式下的首尾锚点 */
  _startAnchor?: Comment;
  _endAnchor?: Comment;
  /** 是否为 Fragment 模式 */
  isFragment: boolean;
  /** 组件级 updateFn */
  update: () => void;

  refs: Set<Ref<any>>
}
/**
 * 挂载函数组件，创建组件级 updateFn 实现独立的依赖收集和更新
 * 
 * 支持两种组件写法：
 * 
 * 1. Setup 模式（推荐）—— 组件函数返回一个 render 函数：
 *    function Home() {
 *      const list = reactive([...])  // setup 阶段，只执行一次
 *      return () => <div>...</div>   // render 函数，每次更新重新执行
 *    }
 * 
 * 2. 直接模式（兼容）—— 组件函数直接返回 DOM：
 *    function Card(props) {
 *      return <div>{props.title}</div>  // 无状态组件，每次父级更新会重建
 *    }
 * 
 * 原理：
 * - 暂存父级的 currentUpdateFn
 * - 设置组件自己的 componentUpdateFn 为 currentUpdateFn
 * - 执行组件函数 → 如果返回函数则为 setup 模式
 * - setup 模式下：调用 renderFn 时，组件内部 reactive 数据会收集到 componentUpdateFn
 * - 恢复父级的 currentUpdateFn
 * - 数据变化时，只触发 componentUpdateFn → 仅重渲染该组件
 */
function mountComponent(tag: Function, mergedProps: Record<string, any>): HTMLElement | SVGElement | DocumentFragment {
  // 如果没有注入 hooks（core 层未初始化），退回直接调用
  if (!_getCurrentUpdateFn || !_setCurrentUpdateFn) {
    const r = tag(mergedProps);
    if (typeof r === 'function') return r(mergedProps) as HTMLElement | SVGElement | DocumentFragment;
    return r as HTMLElement | SVGElement | DocumentFragment;
  }

  const getUpdateFn = _getCurrentUpdateFn;
  const setUpdateFn = _setCurrentUpdateFn;

  // 组件实例
  const instance: ComponentInstance = {
    setupFn: tag,
    renderFn: tag,
    props: mergedProps,
    el: null,
    isFragment: false,
    update: null!,
    refs: new Set()
  };

  // 组件级更新函数
  const componentUpdateFn = () => {
    if (!instance.el) return;

    // 切换到自己的 updateFn 以便重新收集依赖
    const prev = getUpdateFn();
    setUpdateFn(componentUpdateFn);

    const prevInstance = _getCurrentInstance?.() ?? null;
    _setCurrentInstance?.(instance);
    console.log('instance: ', instance);
    const newResult = instance.renderFn(instance.props);
    _setCurrentInstance?.(prevInstance);

    setUpdateFn(prev);

    if (instance.isFragment) {
      patchComponentFragment(instance, newResult as DocumentFragment);
    } else {
      const oldEl = instance.el as Element;
      if (oldEl.parentNode) {
        const newEl = diffElement(oldEl, newResult as Element);
        if (newEl !== oldEl) {
          instance.el = newEl;
          (newEl as any)._componentInstance = instance;
        }
      }
    }
  };

  instance.update = componentUpdateFn;

  // 保存父级上下文，切换到当前组件
  const parentUpdateFn = getUpdateFn();
  const prevInstance = _getCurrentInstance?.() ?? null;
  _setCurrentInstance?.(instance);
  setUpdateFn(componentUpdateFn);

  // 执行组件函数（setup 阶段）
  const setupResult = tag(mergedProps);

  let domResult: HTMLElement | SVGElement | DocumentFragment;

  if (typeof setupResult === 'function') {
    // Setup 模式：setupResult 是 render 函数
    instance.renderFn = setupResult;
    // 执行 render 函数获取首次 DOM（在 componentUpdateFn 下执行，收集依赖）
    domResult = setupResult(mergedProps) as HTMLElement | SVGElement | DocumentFragment;
  } else {
    // 直接模式：setupResult 就是 DOM
    domResult = setupResult as HTMLElement | SVGElement | DocumentFragment;
  }

  // 恢复父级上下文
  setUpdateFn(parentUpdateFn);
  _setCurrentInstance?.(prevInstance);

  // 在返回的 DOM 上标记组件实例
  if (domResult instanceof DocumentFragment) {
    instance.isFragment = true;
    return setupComponentFragment(instance, domResult);
  } else {
    (domResult as any)._componentInstance = instance;
    instance.el = domResult;
    return domResult;
  }
}

/**
 * 为 Fragment 类型的组件结果设置锚点追踪
 * 返回一个包含锚点和内容的 DocumentFragment
 */
function setupComponentFragment(instance: ComponentInstance, fragment: DocumentFragment): DocumentFragment {
  const startAnchor = document.createComment(`component-start`);
  const endAnchor = document.createComment(`component-end`);
  
  instance._startAnchor = startAnchor;
  instance._endAnchor = endAnchor;

  const wrapper = document.createDocumentFragment();
  wrapper.appendChild(startAnchor);
  
  while (fragment.firstChild) {
    wrapper.appendChild(fragment.firstChild);
  }
  
  wrapper.appendChild(endAnchor);
  
  (startAnchor as any)._componentInstance = instance;
  instance.el = startAnchor;
  
  return wrapper;
}

/**
 * 更新 Fragment 类型的组件
 */
function patchComponentFragment(instance: ComponentInstance, newFragment: DocumentFragment) {
  const startAnchor = instance._startAnchor;
  const endAnchor = instance._endAnchor;

  if (!startAnchor || !endAnchor || !startAnchor.parentNode) return;
  // 确保 endAnchor 与 startAnchor 在同一父节点下
  if (endAnchor.parentNode !== startAnchor.parentNode) return;

  const parent = startAnchor.parentNode;

  // 收集旧子节点（锚点之间）
  const oldChildren: Node[] = [];
  let current: Node | null = startAnchor.nextSibling;
  while (current && current !== endAnchor) {
    oldChildren.push(current);
    current = current.nextSibling;
  }

  const newChildren = Array.from(newFragment.childNodes);
  reconcileFragmentChildren(parent, startAnchor, endAnchor, oldChildren, newChildren);
}

/**
 * 递归添加子元素
 */
function appendChildren(parent: HTMLElement | SVGElement | DocumentFragment, children: Child[]) {
  for (const child of children) {
    if (child == null || typeof child === "boolean") {
      continue;
    } else if (Array.isArray(child)) {
      // 处理嵌套数组（如 map 返回的数组）
      appendChildren(parent, child);
    } else if (typeof child === "string" || typeof child === "number") {
      parent.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    }
  }
}

/**
 * react-jsx transform 的 jsx/jsxs 函数
 * 签名: jsx(type, props, key)
 * 注意：与 createElement(type, props, ...children) 不同！
 * - children 在 props.children 中（而非展开参数）
 * - key 是独立的第三个参数
 */
export function jsx(
  tag: Tag,
  props: Record<string, any> | null,
  key?: any
): HTMLElement | SVGElement | DocumentFragment {
  if (tag === Fragment) {
    return Fragment(props || {});
  }
  // 将 key 合并回 props
  if (key != null) {
    props = props ? { ...props, key } : { key };
  }
  return createElement(tag, props);
}

export const jsxs = jsx;
