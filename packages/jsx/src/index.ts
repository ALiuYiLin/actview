// ============================================================
// @actview/jsx — 包入口
// ============================================================

// 引入全局 JSX 类型增强（JSX.IntrinsicElements 等），
// 构建后该副作用 import 会保留在 d.ts 中，消费方加载即全局生效
import './global.js'

export {
  jsx,
  jsxs,
  jsxDEV,
  createElement,
  isValidElement,
  Fragment,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
} from './jsxFactory.js'

export type {
  VNode,
  VNodeTypes,
  VNodeKey,
  VNodeChild,
  VNodeChildren,
  LazyVNode,
  HtmlProps,
  InputProps,
  FormEvent,
} from './types.js'
