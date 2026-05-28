/**
 * compile — 公开入口
 *
 * compile() :  首次挂载组件到 DOM 元素
 * rerender() : 由响应式系统触发，patch 更新
 */

import { isVNode } from '@actview/jsx';
import type { VNode } from '@actview/jsx';
import { mount, patch } from './reconciler';

// ======== 全局状态 ========

let rootContainer: Element | null = null;
let prevRootVNode: VNode | null = null;

// ======== 公开 API ========

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
