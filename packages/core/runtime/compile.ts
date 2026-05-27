/**
 * compile — 编译入口，Vue 式 VNode → mount / patch → DOM
 *
 * 流程：
 *   1. compile() 调用组件函数得到 VNode 树
 *   2. mount() 递归创建 DOM，首次挂载（含 reactive 上下文注入）
 *   3. patch() diff 新旧 VNode，增量更新 DOM
 *   4. rerender() 由响应式系统触发，走 patch 路径
 *
 * Reactive：
 *   组件执行时设置 currentUpdateFn，组件内 ref.value 的读操作
 *   自动将 currentUpdateFn 注册为该 ref 的依赖。
 *   ref 变化时 → publish → 触发 componentUpdateFn → re-patch。
 */

import { isVNode, ACTVIEW_FRAGMENT } from '@actview/jsx';
import type { VNode } from '@actview/jsx';
import { getCurrentUpdateFn, setCurrentUpdateFn, getCurrentInstance, setCurrentInstance } from '../hooks';
import { eventBus } from '../reactivity/event';

// ======== SVG 支持 ========

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect',
  'g', 'defs', 'use', 'symbol', 'clipPath', 'mask', 'pattern', 'image',
  'text', 'tspan', 'textPath', 'foreignObject', 'marker', 'linearGradient',
  'radialGradient', 'stop', 'filter', 'animate', 'animateTransform',
]);

function isSvgTag(tag: string): boolean {
  return SVG_TAGS.has(tag);
}

// ======== 状态 ========

/** 树根容器，compile 时记录 */
let rootContainer: Element | null = null;
/** 上一轮的 VNode 树顶层 VNode */
let prevRootVNode: VNode | null = null;

// ======== Props Diff ========

function patchProps(el: Element, oldProps: Record<string, any>, newProps: Record<string, any>): void {
  for (const key of Object.keys(oldProps)) {
    if (key === 'children' || key === 'key') continue;
    if (!(key in newProps)) {
      if (key.startsWith('on') && typeof oldProps[key] === 'function') {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else if (key === 'style' && typeof oldProps[key] === 'object') {
        (el as HTMLElement).style.cssText = '';
      } else {
        el.removeAttribute(key);
      }
    }
  }

  for (const [key, value] of Object.entries(newProps)) {
    if (key === 'children' || key === 'key') continue;
    if (value === oldProps[key]) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      if (oldProps[key] && oldProps[key] !== value) {
        el.removeEventListener(eventName, oldProps[key]);
      }
      if (!oldProps[key]) {
        el.addEventListener(eventName, value);
      }
    } else if (key === 'className' || key === 'class') {
      el.setAttribute('class', String(value));
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign((el as HTMLElement).style, value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else if (value !== false && value != null) {
      el.setAttribute(key, String(value));
    } else if (value === false || value == null) {
      el.removeAttribute(key);
    }
  }
}

/**
 * 在指定组件的 reactive 上下文中执行 fn
 * （执行期间 ref 的读操作会被收集到该组件的 updateFn 上）
 */
function withReactiveContext<T>(
  updateFn: (() => void) | null,
  instance: { refs: Set<any> },
  fn: () => T,
): T {
  const prevFn = getCurrentUpdateFn();
  setCurrentUpdateFn(updateFn);
  const prevInst = getCurrentInstance();
  setCurrentInstance(instance);
  const result = fn();
  setCurrentInstance(prevInst);
  setCurrentUpdateFn(prevFn);
  return result;
}

/** 组件实例（仅用于收集 refs 做卸载清理） */
function createCompInstance(): { refs: Set<any> } {
  return { refs: new Set<any>() };
}

// ======== Mount（首次渲染） ========

function mount(vnode: VNode, parent: Node): Node {
  // 函数组件：注入 reactive 上下文后执行
  if (typeof vnode.type === 'function') {
    const compType = vnode.type;
    const instance = createCompInstance();

    // 执行组件（setup），获取后续 render 函数
    const setupResult = compType(vnode.props ?? {});
    // setup 模式：组件返回 render 函数；否则直接返回 VNode
    const renderFn: () => VNode = typeof setupResult === 'function'
      ? setupResult as () => VNode
      : () => compType(vnode.props ?? {});

    // 组件级更新函数（被 ref 变化触发时重渲染）
    // 注意：调用的是缓存的 renderFn，而不是 compType（否则会重复执行 setup）
    const componentUpdateFn = () => {
      const prevFn = getCurrentUpdateFn();
      setCurrentUpdateFn(componentUpdateFn);
      const prevInst = getCurrentInstance();
      setCurrentInstance(instance);

      const newChild = renderFn();
      const oldChild = (vnode as any)._resolved;

      if (oldChild && (vnode as any)._parentNode) {
        patch(oldChild, newChild, (vnode as any)._parentNode);
        (vnode as any)._resolved = newChild;
      }

      setCurrentInstance(prevInst);
      setCurrentUpdateFn(prevFn);
    };

    // 首次渲染 — 在组件 reactive 上下文中执行 renderFn
    const child = (() => {
      const prevFn = getCurrentUpdateFn();
      setCurrentUpdateFn(componentUpdateFn);
      const prevInst = getCurrentInstance();
      setCurrentInstance(instance);
      const r = renderFn();
      setCurrentInstance(prevInst);
      setCurrentUpdateFn(prevFn);
      return r;
    })();

    (vnode as any)._resolved = child;
    (vnode as any)._update = componentUpdateFn;
    (vnode as any)._instance = instance;
    (vnode as any)._renderFn = renderFn;
    (vnode as any)._parentNode = parent;

    return mount(child, parent);
  }

  // 文本节点
  if (vnode.type === 'TEXT') {
    const text = document.createTextNode(vnode.children as string ?? '');
    parent.appendChild(text);
    vnode.el = text;
    return text;
  }

  // Fragment
  if (vnode.type === ACTVIEW_FRAGMENT) {
    const arr = toChildArray(vnode.children);
    for (const c of arr) mount(c, parent);
    return parent;
  }

  // 宿主元素
  const tag = vnode.type as string;
  const el = isSvgTag(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  patchProps(el, {}, vnode.props ?? {});
  const arr = toChildArray(vnode.children);
  for (const c of arr) mount(c, el);

  parent.appendChild(el);
  vnode.el = el;
  return el;
}

function toChildArray(children: VNode[] | string | null): VNode[] {
  if (children == null) return [];
  if (typeof children === 'string') {
    return [{ __v_isVNode: true, type: 'TEXT', props: null, children, key: null, el: null }];
  }
  return children;
}

// ======== Patch（更新） ========

function patch(oldV: VNode, newV: VNode, parent: Node): Node {
  // 类型不同 → 替换
  if (oldV.type !== newV.type) {
    const dom = mount(newV, parent);
    unmount(oldV);
    return dom;
  }

  // 函数组件：在旧组件的 reactive 上下文中重新执行
  if (typeof newV.type === 'function') {
    const renderFn = (oldV as any)._renderFn as (() => VNode) | null;
    const existingUpdate = (oldV as any)._update as (() => void) | null;
    const existingInstance = (oldV as any)._instance as { refs: Set<any> };
    const oldResolved = (oldV as any)._resolved as VNode | null;

    let newResolved: VNode;
    if (renderFn) {
      newResolved = existingUpdate && existingInstance
        ? withReactiveContext(existingUpdate, existingInstance, () => renderFn())
        : renderFn();
    } else {
      // 没有缓存（兼容），退回到直接执行
      const compType = newV.type as (props: any) => any;
      let r: any = compType(newV.props ?? {});
      while (typeof r === 'function') r = r();
      newResolved = r;
    }

    // 继承旧 VNode 的 reactive 状态
    (oldV as any)._resolved = newResolved;
    (newV as any)._update = existingUpdate;
    (newV as any)._instance = existingInstance;
    (newV as any)._renderFn = renderFn;
    (newV as any)._parentNode = (oldV as any)._parentNode;

    if (oldResolved) {
      return patch(oldResolved, newResolved, parent);
    }
    return mount(newResolved, parent);
  }

  // 文本节点
  if (newV.type === 'TEXT') {
    const textEl = oldV.el as Text;
    const newText = typeof newV.children === 'string' ? newV.children : '';
    if (textEl.nodeValue !== newText) textEl.nodeValue = newText;
    newV.el = textEl;
    return textEl;
  }

  // Fragment
  if (newV.type === ACTVIEW_FRAGMENT) {
    patchChildren(oldV, newV, parent);
    return parent;
  }

  // 宿主元素
  const el = oldV.el as Element;
  patchProps(el, oldV.props ?? {}, newV.props ?? {});

  // 文本子节点直接操作 textContent，不走 patchChildren
  // （patchChildren 内的 toChildArray 会创建无 el 的合成 TEXT VNode）
  const oldStr = typeof oldV.children === 'string';
  const newStr = typeof newV.children === 'string';
  if (oldStr && newStr) {
    const text = newV.children as string;
    if (el.textContent !== text) el.textContent = text;
  } else if (newStr) {
    el.textContent = newV.children as string;
  } else if (oldStr) {
    // Text → VNode children：先清空文本再走 patchChildren
    el.textContent = '';
    patchChildren(oldV, newV, el);
  } else {
    patchChildren(oldV, newV, el);
  }

  newV.el = el;
  return el;
}

function patchChildren(oldV: VNode, newV: VNode, parent: Node): void {
  const oldArr = toChildArray(oldV.children);
  const newArr = toChildArray(newV.children);

  const max = Math.max(oldArr.length, newArr.length);
  for (let i = 0; i < max; i++) {
    const oc = oldArr[i];
    const nc = newArr[i];

    if (oc && nc) {
      patch(oc, nc, parent);
    } else if (nc && !oc) {
      mount(nc, parent);
    } else if (oc && !nc) {
      unmount(oc);
    }
  }
}

// ======== Unmount（卸载） ========

function unmount(vnode: VNode): void {
  if (typeof vnode.type === 'function') {
    // 清理组件级 ref 订阅
    const instance = (vnode as any)._instance as { refs: Set<any> } | undefined;
    const updateFn = (vnode as any)._update as (() => void) | undefined;
    if (instance && updateFn && instance.refs.size > 0) {
      eventBus.unsubscribe(updateFn, instance.refs);
    }
    const resolved = (vnode as any)._resolved as VNode | null;
    if (resolved) unmount(resolved);
    return;
  }

  if (vnode.type === ACTVIEW_FRAGMENT) {
    const arr = toChildArray(vnode.children);
    for (const c of arr) unmount(c);
    return;
  }

  if (vnode.el && vnode.el.parentNode) {
    vnode.el.parentNode.removeChild(vnode.el);
  }
}

// ======== 公开入口 ========

export function compile(el: Element, component: () => any): void {
  rootContainer = el;

  const result = component();
  let vnode: VNode;
  if (typeof result === 'function') {
    vnode = result();
  } else {
    vnode = result;
  }

  if (!isVNode(vnode)) return;

  el.textContent = '';
  mount(vnode, el);
  prevRootVNode = vnode;
}

export function rerender(renderFn: () => VNode): void {
  if (!rootContainer || !prevRootVNode) return;
  const newVNode = renderFn();
  if (!isVNode(newVNode)) return;
  patch(prevRootVNode, newVNode, rootContainer);
  prevRootVNode = newVNode;
}
