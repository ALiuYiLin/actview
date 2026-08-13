// ============================================================
// JSX 全局类型增强 — 通过 tsconfig include 加载，全局生效
// ============================================================

import type {
  VNode,
  VNodeTypes,
  HtmlProps,
  InputProps,
  ComponentType
} from './types.js'

declare global {
  namespace JSX {
    type Element = VNode
    /** 组件对象（defineComponent 产物 { __setup }）也可作为 JSX 元素 */
    type ElementType = VNodeTypes | ComponentType
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

    /**
     * 组件元素 props 检查：声明类型 + 任意额外属性（class、style、data-*、on* 等）。
     * 对齐 React 宽松语义：声明内属性做类型检查，额外 HTML 属性/事件允许传入
     * （props 全量进 setup，用户显式 {...props} 选择透传）。
     */
    type LibraryManagedAttributes<C, P> = P & Record<string, any>
  }
}

export {}
