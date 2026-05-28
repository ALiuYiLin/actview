/**
 * Reconciler — VNode → DOM 的挂载/更新/卸载
 *
 * mount  → 首次渲染，递归创建 DOM
 * patch  → 对比新旧 VNode，增量更新 DOM
 * unmount → 卸载 VNode 对应的 DOM，清理 ref 订阅
 */

import { isVNode, ACTVIEW_FRAGMENT } from '@actview/jsx';
import type { VNode } from '@actview/jsx';
import { eventBus } from '../reactivity/event';
import { isSvgTag, patchProps } from './dom';
import { withReactiveContext, createCompInstance } from './context';
import { extractSlotProps } from './slot';

// ======== Mount ========

export function mount(vnode: VNode, parent: Node): Node {
  // 函数组件
  if (typeof vnode.type === 'function') {
    return mountComponent(vnode, parent);
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
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  patchProps(el, {}, vnode.props ?? {});
  const arr = toChildArray(vnode.children);
  for (const c of arr) mount(c, el);

  parent.appendChild(el);
  vnode.el = el;
  return el;
}

function mountComponent(vnode: VNode, parent: Node): Node {
  const compType = vnode.type as Function;
  const instance = createCompInstance();

  const slotProps = extractSlotProps(vnode.props ?? {}, vnode.children);

  // 执行 setup，获取 render 函数
  const setupResult = compType(slotProps);
  const renderFn = typeof setupResult === 'function'
    ? setupResult as (props?: any) => VNode
    : (p?: any) => compType(p ?? slotProps);

  // 组件级更新函数
  const componentUpdateFn = () => {
    const prevFn = getCurrentUpdateFn();
    setCurrentUpdateFn(componentUpdateFn);
    const prevInst = getCurrentInstance();
    setCurrentInstance(instance);
    console.log('instance: ', instance);

    const props = (vnode as any)._capturedProps || slotProps;
    const newChild = renderFn(props);
    const oldChild = (vnode as any)._resolved;

    if (oldChild && (vnode as any)._parentNode) {
      patch(oldChild, newChild, (vnode as any)._parentNode);
      (vnode as any)._resolved = newChild;
    }

    setCurrentInstance(prevInst);
    setCurrentUpdateFn(prevFn);
  };

  // 首次渲染
  const child = (() => {
    const prevFn = getCurrentUpdateFn();
    setCurrentUpdateFn(componentUpdateFn);
    const prevInst = getCurrentInstance();
    setCurrentInstance(instance);
    const r = renderFn(slotProps);
    setCurrentInstance(prevInst);
    setCurrentUpdateFn(prevFn);
    return r;
  })();

  (vnode as any)._capturedProps = slotProps;
  (vnode as any)._resolved = child;
  (vnode as any)._update = componentUpdateFn;
  (vnode as any)._instance = instance;
  (vnode as any)._renderFn = renderFn;
  (vnode as any)._parentNode = parent;

  return mount(child, parent);
}

// ======== Patch ========

/**
 * VNode diff 入口，将 oldV 代表的 DOM 增量更新为 newV 的状态
 *
 * 策略（同类型就地更新，不同类型替换）：
 *
 * ├─ type 不同 → mount(newV) + unmount(oldV) → 完全替换
 * │
 * ├─ 函数组件 → patchComponent
 * │   复用旧组件的 renderFn / updateFn，在 reactive 上下文中
 * │   重新执行 renderFn 得到新 VNode，patch 新旧 resolved 树
 * │
 * ├─ TEXT    → el.nodeValue = newText
 * ├─ Fragment → patchChildren 透传
 * │
 * └─ 宿主元素 → patchProps + 处理 children
 *     ├─ children 都是 string → el.textContent
 *     ├─ 新是 string          → el.textContent（清掉旧 VNode）
 *     ├─ 旧是 string          → 清空文本后 patchChildren
 *     └─ 都是 VNode[]        → patchChildren
 */
export function patch(oldV: VNode, newV: VNode, parent: Node): Node {
  // 类型不同 → 替换
  if (oldV.type !== newV.type) {
    const dom = mount(newV, parent);
    unmount(oldV);
    return dom;
  }

  // 函数组件
  if (typeof newV.type === 'function') {
    return patchComponent(oldV, newV, parent);
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

  const oldStr = typeof oldV.children === 'string';
  const newStr = typeof newV.children === 'string';
  if (oldStr && newStr) {
    const text = newV.children as string;
    if (el.textContent !== text) el.textContent = text;
  } else if (newStr) {
    el.textContent = newV.children as string;
  } else if (oldStr) {
    el.textContent = '';
    patchChildren(oldV, newV, el);
  } else {
    patchChildren(oldV, newV, el);
  }

  newV.el = el;
  return el;
}

function patchComponent(oldV: VNode, newV: VNode, parent: Node): Node {
  const renderFn = (oldV as any)._renderFn as ((props?: any) => VNode) | null;
  const existingUpdate = (oldV as any)._update as (() => void) | null;
  const existingInstance = (oldV as any)._instance as { refs: Set<any> };
  const oldResolved = (oldV as any)._resolved as VNode | null;

  let newResolved: VNode;
  let capturedProps: Record<string, any> | null = null;

  if (renderFn) {
    const newSlotProps = newV.props ? extractSlotProps(newV.props, newV.children) : {};
    capturedProps = (oldV as any)._capturedProps || oldV.props;

    if (capturedProps) {
      for (const key of Object.keys(newSlotProps)) {
        const oldVal = capturedProps[key];
        const newVal = newSlotProps[key];
        if (typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal) &&
            typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
          Object.assign(oldVal, newVal);
        } else {
          capturedProps[key] = newVal;
        }
      }
    }

    newResolved = existingUpdate && existingInstance
      ? withReactiveContext(existingUpdate, existingInstance, () => renderFn(capturedProps))
      : renderFn(capturedProps);
  } else {
    const compType = newV.type as (props: any) => any;
    let r: any = compType(newV.props ?? {});
    while (typeof r === 'function') r = r();
    newResolved = r;
  }

  (oldV as any)._resolved = newResolved;
  (newV as any)._resolved = newResolved;
  (newV as any)._update = existingUpdate;
  (newV as any)._instance = existingInstance;
  (newV as any)._renderFn = renderFn;
  (newV as any)._capturedProps = capturedProps;
  (newV as any)._parentNode = (oldV as any)._parentNode;

  if (oldResolved) return patch(oldResolved, newResolved, parent);
  return mount(newResolved, parent);
}

function patchChildren(oldV: VNode, newV: VNode, parent: Node): void {
  const oldArr = toChildArray(oldV.children);
  const newArr = toChildArray(newV.children);

  const useKey = oldArr.some(c => c.key != null) || newArr.some(c => c.key != null);

  if (useKey) {
    keyedPatchChildren(oldArr, newArr, parent);
  } else {
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
}

// ======== Keyed Children ========

function keyedPatchChildren(oldArr: VNode[], newArr: VNode[], parent: Node): void {
  const oldMap = new Map<string, VNode>();
  for (const c of oldArr) {
    if (c.key != null) oldMap.set(c.key, c);
  }

  const reused = new Set<VNode>();

  for (const nc of newArr) {
    const oc = nc.key != null ? oldMap.get(nc.key) : undefined;
    if (oc) {
      reused.add(oc);
      patch(oc, nc, parent);
    } else {
      mount(nc, parent);
    }
  }

  for (const oc of oldArr) {
    if (!reused.has(oc)) unmount(oc);
  }

  reorderDOM(newArr, parent);
}

function resolveDOM(vnode: VNode): Node | null {
  if (vnode.el) return vnode.el;
  if (typeof vnode.type === 'function') {
    const r = (vnode as any)._resolved;
    return r ? resolveDOM(r) : null;
  }
  return null;
}

function reorderDOM(arr: VNode[], parent: Node): void {
  for (let i = 0; i < arr.length; i++) {
    const dom = resolveDOM(arr[i]);
    if (!dom) continue;
    const target = parent.childNodes[i];
    if (dom !== target && target) {
      parent.insertBefore(dom, target);
    }
  }
}

// ======== Unmount ========

export function unmount(vnode: VNode): void {
  if (typeof vnode.type === 'function') {
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

// ======== 共享工具 ========

function toChildArray(children: VNode[] | string | null): VNode[] {
  if (children == null) return [];
  if (typeof children === 'string') {
    return [{ __v_isVNode: true, type: 'TEXT', props: null, children, key: null, el: null }];
  }
  return children;
}

// 需要引用 getCurrentUpdateFn/setCurrentUpdateFn/getCurrentInstance/setCurrentInstance
import { getCurrentUpdateFn, setCurrentUpdateFn, getCurrentInstance, setCurrentInstance } from '../hooks';
