// ============================================================
// renderChallenge — 挑战专用渲染辅助
//   与 @actview/testing 的 render 区别：支持 props 传入 + setProps，
//   用于黑盒验收"props 更新后组件是否响应"（框架理解的核心考点）。
//   机制：包装组件在 render 时展开 shallowReactive props 传给用户组件，
//   setProps 就地写入 → 依赖触发重渲染 → 子组件 patch 收到新 props。
// ============================================================

import { createApp, defineComponent, shallowReactive } from '@actview/core'
import { createElement } from '@actview/jsx'
import type { ChallengeRenderResult } from './types'

let seq = 0

/** 深度优先遍历子树元素（不含根容器自身） */
function walkElements(root: Element, cb: (el: HTMLElement) => void) {
  const visit = (el: Element) => {
    for (const child of Array.from(el.children)) {
      cb(child as HTMLElement)
      visit(child)
    }
  }
  visit(root)
}

function queryAllByText(root: Element, text: string): HTMLElement[] {
  const out: HTMLElement[] = []
  walkElements(root, (el) => {
    if (el.textContent != null && el.textContent.includes(text)) out.push(el)
  })
  return out
}

function buildQueries(container: HTMLElement) {
  const getByText = (text: string): HTMLElement => {
    const el = queryAllByText(container, text)[0]
    if (!el) throw new Error(`[challenges] 找不到文本 "${text}"`)
    return el
  }
  const queryByText = (text: string): HTMLElement | null =>
    queryAllByText(container, text)[0] ?? null
  const getByClass = (cls: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`.${cls}`)
    if (!el) throw new Error(`[challenges] 找不到 class "${cls}"`)
    return el
  }
  const queryByClass = (cls: string): HTMLElement | null =>
    container.querySelector<HTMLElement>(`.${cls}`)
  const getByTestId = (id: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!el) throw new Error(`[challenges] 找不到 data-testid "${id}"`)
    return el
  }
  const queryByTestId = (id: string): HTMLElement | null =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`)

  return { getByText, queryByText, getByClass, queryByClass, getByTestId, queryByTestId }
}

/**
 * 渲染用户组件到独立容器，支持初始 props 与 setProps（响应性验收）。
 * 返回查询辅助 + setProps + unmount。
 */
export function renderChallenge(
  component: any,
  options: { props?: Record<string, unknown> } = {}
): ChallengeRenderResult {
  // shallowReactive props：setProps 写入触发依赖 → 包装组件重渲染
  const props = shallowReactive<any>({ ...(options.props ?? {}) })

  // 包装组件：render 时展开 props 传给用户组件（每次 render 读 props → 收集依赖）
  const Wrapper = defineComponent(() => () =>
    createElement(component, { ...props })
  )

  const container = document.createElement('div')
  container.id = 'challenge-host-' + seq++
  document.body.appendChild(container)
  createApp(Wrapper).mount('#' + container.id)

  return {
    container,
    setProps(next: Record<string, unknown>) {
      Object.assign(props, next)
    },
    ...buildQueries(container)
  }
}
