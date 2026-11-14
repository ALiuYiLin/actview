// ============================================================
// Suspense — 异步边界（M3，第一版类组件迁移）
//
//   h(Suspense, { fallback: h('span', 'loading') }, h(AsyncComp))
//
// 机制：
//   1. 模块级 suspense 栈：Suspense setup 时入栈、卸载时出栈；
//   2. async setup 组件挂载时，renderer 调 getCurrentSuspense() 拿到最近
//      Suspense 的 ctx 并 register()（pending = true → 显示 fallback）；
//      Promise resolve / reject 后 resolve()（隐藏 fallback）；
//   3. children 始终挂载（pending 时由外层 div 的 display:none 隐藏，
//      不卸载重挂，避免异步组件 setup 反复执行）；fallback 仅在 pending 时追加。
// ============================================================

import {
  Fragment,
  createVNode,
  type VNodeChild,
} from '../internal'
import type { ComponentInternalInstance } from '../runtime/instance'
import { ActViewComponent, Component, Ref, Setup } from '../decorator'
import { getCurrentInstance, onBeforeUnmount } from '../lifecycle'

/** 最近 Suspense 的挂起上下文（renderer 用它 register / resolve async setup） */
export interface SuspenseContext {
  register(): void
  resolve(): void
}

/** Suspense 实例栈（模块级，供 renderer 查最近的边界） */
const suspenseStack: ComponentInternalInstance[] = []

export function pushSuspense(instance: ComponentInternalInstance): void {
  suspenseStack.push(instance)
}

export function popSuspense(instance: ComponentInternalInstance): void {
  const index = suspenseStack.indexOf(instance)
  if (index >= 0) suspenseStack.splice(index, 1)
}

/**
 * 当前最近的 Suspense 挂起上下文；不在 Suspense 内（或边界未就绪）→ null。
 */
export function getCurrentSuspense(): SuspenseContext | null {
  const instance = suspenseStack[suspenseStack.length - 1]
  return instance?.suspenseCtx ?? null
}

@Component({ name: 'Suspense', inheritAttrs: false })
export class Suspense extends ActViewComponent<Record<string, any>> {
  @Ref
  pending = false

  @Setup
  setup(): void {
    const self = getCurrentInstance()
    if (!self) return

    // async setup 组件通过 renderer ↔ getCurrentSuspense 找到这里。
    // 注意：register 在子树「首次挂载」期间被调用，此时本组件的 render
    // effect 仍在 RUNNING（自触发保护会吞掉 pending 写入）——显式入队
    // 一次更新，保证 loading fallback 能渲染；resolve 同理（幂等去重）。
    self.suspenseCtx = {
      register: () => {
        this.pending = true
        self.update()
      },
      resolve: () => {
        this.pending = false
        self.update()
      },
    }

    pushSuspense(self)
    onBeforeUnmount(() => popSuspense(self))
  }

  render() {
    const props = this.$props
    const children = props.children

    // children 始终挂载；pending 时整块 display:none 隐藏（不卸载，保证异步
    // 组件 setup 只执行一次），fallback 在 pending 时追加为兄弟节点。
    const content = createVNode('div', {
      style: this.pending ? { display: 'none' } : null,
      children,
    })

    const nodes: VNodeChild[] = [content]
    if (this.pending) nodes.push(props.fallback ?? null)

    // 用 Fragment 组织「隐藏的 children 容器 + fallback」，无额外宿主节点
    return createVNode(Fragment, { children: nodes })
  }
}

