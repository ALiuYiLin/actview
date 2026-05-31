/// <reference types="vite/client" />

// ============================================================
// JSX 类型声明
// 配合 tsconfig.json "jsx": "react-jsx" / "jsxImportSource": "@actview/jsx"
// 让 TypeScript 能够校验 JSX 元素属性类型。
// ============================================================

declare namespace JSX {
  type Element = import('@actview/jsx').VNode

  interface IntrinsicElements {
    [elem: string]: any
  }

  interface ElementChildrenAttribute {
    children: unknown
  }
}
