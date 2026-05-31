// ============================================================
// @actview/jsx — 入口
// 当 tsconfig 设置 "jsxImportSource": "@actview/jsx" 时，
// TypeScript 自动从此模块导入 jsx/jsxs 运行时。
// 同时通过 declare global 注入 JSX 命名空间，
// 使 onXxx 事件属性获得代码提示和类型校验。
// ============================================================

import './jsx-global'

export { jsx, jsxs, jsxDEV, isVNode, formatVNode, Fragment } from './jsx'
export { createVNode } from './types'
export type {
  VNode,
  VNodeChild,
  VNodeChildren,
  VNodeKey,
  Component,
} from './types'
