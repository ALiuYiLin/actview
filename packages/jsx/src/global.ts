// ============================================================
// JSX 全局类型增强 — 通过 tsconfig include 加载，全局生效
// ============================================================

import type { VNode, VNodeTypes, HtmlProps, InputProps } from './types.js'

declare global {
  namespace JSX {
    type Element = VNode
    type ElementType = VNodeTypes
    type ArrayElement = VNode[]
    type Child = VNode | string | number | boolean | null | undefined
    type Children = Child | Child[]

    interface IntrinsicElements {
      input: InputProps
      [tag: string]: HtmlProps
    }

    interface ElementChildrenAttribute {
      children: unknown
    }
  }
}

export {}
