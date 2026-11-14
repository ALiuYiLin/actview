// ============================================================
// @actview/core — TransitionGroup / Dynamic 辅助组件
//
// TransitionGroup：
//   把每个子节点包一层内置 Transition，复用 renderer 的 enter/leave 编排；
//   外层默认渲染 <div>，可用 tag 指定，keyed 子节点保持原有 key。
//
// Dynamic：
//   <Dynamic is={Current} {...props} />，按 is 动态渲染组件/标签。
// ============================================================

import { createVNode, type BuiltinComponent, type VNodeChild } from '../internal'
import { ActViewComponent, Component, Prop } from '../decorator'
import { Transition } from './Transition'

function flattenChildren(children: unknown): VNodeChild[] {
  if (children == null || typeof children === 'boolean') return []
  const list = Array.isArray(children)
    ? (children as unknown[]).flat(Infinity)
    : [children]
  return list.filter(
    (child) => child != null && typeof child !== 'boolean',
  ) as VNodeChild[]
}

@Component({ name: 'TransitionGroup' })
export class TransitionGroup extends ActViewComponent<Record<string, any>> {
  @Prop
  tag = 'div'

  @Prop
  name = 'v'

  @Prop
  duration = 300

  @Prop
  class: string | null = null

  @Prop
  style: any = null

  @Prop
  onEnter: ((el: Element) => void) | null = null

  @Prop
  onLeave: ((el: Element) => void) | null = null

  render() {
    const children = flattenChildren(this.$props.children)
    const wrapped = children.map((child, index) => {
      const key =
        (child as { key?: string | number | null } | null)?.key ?? index
      return createVNode(
        Transition as unknown as BuiltinComponent,
        {
          name: this.name,
          duration: this.duration,
          onEnter: this.onEnter,
          onLeave: this.onLeave,
          children: child,
        },
        key,
      )
    })

    return createVNode(this.tag, {
      class: this.class,
      style: this.style,
      children: wrapped,
    })
  }
}

@Component({ name: 'Dynamic', inheritAttrs: false })
export class Dynamic extends ActViewComponent<Record<string, any>> {
  @Prop
  is!: any

  render() {
    const { is, key, ...props } = this.$props
    if (!is) return null
    return createVNode(is, props, key ?? null)
  }
}
