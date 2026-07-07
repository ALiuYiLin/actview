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
export type { HtmlProps, InputProps } from './types.js';
export { LAZY_VNODE } from './jsxFactory.js';
