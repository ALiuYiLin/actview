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
      if (oldProps[key]) el.removeEventListener(eventName, oldProps[key]);
      el.addEventListener(eventName, value);
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

/**
 * 从 VNode 的 children 中提取 template[slot] 子节点为命名 props
 *
 * jsx 工厂将 children 放在 vnode.children 而非 vnode.props.children 中，
 * 因此需要额外传入 children。
 *
 * 输入: children=[template(slot=header), p, template(slot=footer)]
 * 输出: props.header=[slotChildren], props.footer=[slotChildren], props.children=[p]
 */
function extractSlotProps(props: Record<string, any>, children: VNode[] | string | null): Record<string, any> {
  const raw = Array.isArray(children) ? children : null;
  if (!raw) return props;

  const result: Record<string, any> = {};
  for (const key of Object.keys(props)) result[key] = props[key];

  const defaultChildren: any[] = [];
  for (const child of raw) {
    if (isVNode(child) && child.type === 'template' && child.props?.slot) {
      result[child.props.slot] = child.children;
    } else {
      defaultChildren.push(child);
    }
  }

  result.children = defaultChildren.length > 0 ? defaultChildren : null;
  return result;
}

// ======== Mount（首次渲染） ========

function mount(vnode: VNode, parent: Node): Node {
  // 函数组件：注入 reactive 上下文后执行
  if (typeof vnode.type === 'function') {
    const compType = vnode.type;
    const instance = createCompInstance();

    // 提取 slot，构建组件实际接收的 props
    const slotProps = extractSlotProps(vnode.props ?? {}, vnode.children);

    // 执行组件（setup），获取后续 render 函数
    const setupResult = compType(slotProps);
    // setup 模式：组件返回 render 函数；否则直接返回 VNode
    // renderFn 接收当前 props 参数（支持 slot 模式中 (props) => VNode 的写法）
    const renderFn = typeof setupResult === 'function'
      ? setupResult as (props?: any) => VNode
      : (p?: any) => compType(p ?? slotProps);

    // 组件级更新函数（被 ref 变化触发时重渲染）
    const componentUpdateFn = () => {
      const prevFn = getCurrentUpdateFn();
      setCurrentUpdateFn(componentUpdateFn);
      const prevInst = getCurrentInstance();
      setCurrentInstance(instance);

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

    // 首次渲染 — 在组件 reactive 上下文中执行 renderFn
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
    const renderFn = (oldV as any)._renderFn as ((props?: any) => VNode) | null;
    const existingUpdate = (oldV as any)._update as (() => void) | null;
    const existingInstance = (oldV as any)._instance as { refs: Set<any> };
    const oldResolved = (oldV as any)._resolved as VNode | null;

    let newResolved: VNode;
    let capturedProps: Record<string, any> | null = null;
    if (renderFn) {
      // 提取 slot，构建新 props
      const newSlotProps = newV.props ? extractSlotProps(newV.props, newV.children) : {};
      // 合并到 renderFn 闭包捕获的原始 props 对象
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
      // 没有缓存（兼容），退回到直接执行
      const compType = newV.type as (props: any) => any;
      let r: any = compType(newV.props ?? {});
      while (typeof r === 'function') r = r();
      newResolved = r;
    }

    // 继承旧 VNode 的 reactive 状态
    (oldV as any)._resolved = newResolved;
    (newV as any)._resolved = newResolved;
    (newV as any)._update = existingUpdate;
    (newV as any)._instance = existingInstance;
    (newV as any)._renderFn = renderFn;
    (newV as any)._capturedProps = capturedProps;
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

  // 判断是否使用 key（任一数组有 key 就走 keyed reconciliation）
  const useKey = oldArr.some(c => c.key != null) || newArr.some(c => c.key != null);

  if (useKey) {
    keyedPatchChildren(oldArr, newArr, parent);
  } else {
    // 无 key：索引匹配（原逻辑）
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

// ======== Keyed Children Reconciliation ========

/**
 * 基于 key 的子节点协调
 *
 * 1. 用旧子节点的 key 建立 Map
 * 2. 遍历新子节点，按 key 匹配旧节点：
 *    - 匹配且 type 相同 → patch 复用 DOM
 *    - 未匹配 → mount 新节点
 * 3. 删除未匹配的旧节点
 * 4. 重排 DOM 顺序使与新数组一致（解决插入/排序导致的错位）
 */
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

  // 删除未复用(oldMap中有但newArr中没有key)的旧节点
  for (const oc of oldArr) {
    if (!reused.has(oc)) {
      unmount(oc);
    }
  }

  // 按新数组顺序重排真实 DOM
  reorderDOM(newArr, parent);
}

/** 找到 VNode 对应的真实 DOM（穿透函数组件/Fragment） */
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
