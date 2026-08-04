// ============================================================
// JSX 全局类型增强 — 通过 tsconfig include 加载，全局生效
// ============================================================

import type { VNode, VNodeTypes, HtmlProps, InputProps } from './types.js'

declare global {
  namespace JSX {
    type Element = VNode
    /** 组件对象（defineComponent 产物 { __setup }）也可作为 JSX 元素 */
    type ElementType = VNodeTypes | { __setup: (...args: any[]) => any }
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
