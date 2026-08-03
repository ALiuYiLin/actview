/**
 * @local/jsx-factory — main entry
 */
export {
  createElement,
  initJsxFactory,
  setDispatcher,
  getDispatcher,
  getComponentNameFromType,
  cloneElement,
  cloneAndReplaceKey,
  isValidElement,
  isLazyType,
  Fragment,
  ElementType,
} from './jsxFactory.js';

export type { VNode, VNodeTypes, VNodeKey, VNodeChild, VNodeChildren, LazyVNode } from './types.js';
export type { HtmlProps, InputProps, FormEvent } from './types.js';

/** 组件定义包装器 */
export function defineComponent(setup: (...args: any[]) => any): { __setup: (...args: any[]) => any } {
  return { __setup: setup };
}
