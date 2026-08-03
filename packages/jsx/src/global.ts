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

  // ============================================================
  // Babel 组件转换类型增强
  // function Component() → defineComponent() 返回 { __setup }
  // 让 App.__setup()() 调用不报类型错误
  // ============================================================
  interface Function {
    __setup: (props?: Record<string, any>) => () => VNode
  }
}

export {}
