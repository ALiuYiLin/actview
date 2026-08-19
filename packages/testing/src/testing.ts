// ============================================================
// @actview/testing — 组件测试工具（对齐 testing-library，TSX 风格）
//   render(component, { props? })：挂载 + 返回 DOM 查询辅助
//     - props 经 reactive 代理传入，rerender(props) 更新后组件响应式重渲染
//   fireEvent(el, event)：触发事件
//   waitFor(cb)：轮询等待异步更新
//   screen：全局查询（作用于最近 render 的 container）
//   cleanup：卸载全部挂载的组件
// ============================================================

import { createApp, defineComponent, reactive } from '@actview/core'

const mountedContainers: HTMLElement[] = []

let mountSeq = 0

export interface RenderResult {
  /** 挂载容器（宿主元素） */
  container: HTMLElement
  /** 卸载：移除容器 DOM */
  unmount: () => void
  /** 更新 props（经 reactive 代理写入，触发组件响应式重渲染；与 props 合并） */
  rerender: (props: Record<string, any>) => void
  getByText: (text: string) => HTMLElement
  queryByText: (text: string) => HTMLElement | null
  getAllByText: (text: string) => HTMLElement[]
  queryAllByText: (text: string) => HTMLElement[]
  getByClass: (cls: string) => HTMLElement
  queryByClass: (cls: string) => HTMLElement | null
  getByTestId: (id: string) => HTMLElement
  queryByTestId: (id: string) => HTMLElement | null
}

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

/** 查询全部文本匹配（textContent 包含 text）的元素 */
function queryAllByText(root: Element, text: string): HTMLElement[] {
  const out: HTMLElement[] = []
  walkElements(root, (el) => {
    if (el.textContent != null && el.textContent.includes(text)) out.push(el)
  })
  return out
}

function buildQueries(root: HTMLElement) {
  const getByText = (text: string): HTMLElement => {
    const el = queryAllByText(root, text)[0]
    if (!el) throw new Error(`[testing] 找不到文本 "${text}"`)
    return el
  }
  const queryByText = (text: string): HTMLElement | null =>
    queryAllByText(root, text)[0] ?? null
  const getAllByText = (text: string): HTMLElement[] => queryAllByText(root, text)
  const queryAllByTextFn = (text: string): HTMLElement[] =>
    queryAllByText(root, text)

  const getByClass = (cls: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`.${cls}`)
    if (!el) throw new Error(`[testing] 找不到 class "${cls}"`)
    return el
  }
  const queryByClass = (cls: string): HTMLElement | null =>
    root.querySelector<HTMLElement>(`.${cls}`)

  const getByTestId = (id: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!el) throw new Error(`[testing] 找不到 data-testid "${id}"`)
    return el
  }
  const queryByTestId = (id: string): HTMLElement | null =>
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`)

  return {
    getByText,
    queryByText,
    getAllByText,
    queryAllByText: queryAllByTextFn,
    getByClass,
    queryByClass,
    getByTestId,
    queryByTestId
  }
}

/**
 * 挂载组件到自动创建的容器（append 到 body），返回查询辅助。
 * options.container 可指定已有容器（不自动清理）。
 * options.props 为初始 props：经 reactive 代理传入，rerender(props) 更新
 * （内部 Harness 包装，组件收到 props 后照常响应式更新）。
 */
export function render(
  component: any,
  options?: { container?: HTMLElement; props?: Record<string, any> }
): RenderResult {
  const container = options?.container ?? document.createElement('div')
  const autoCreated = !options?.container
  const id = 'testing-' + mountSeq++
  container.id = id
  if (autoCreated) {
    document.body.appendChild(container)
    mountedContainers.push(container)
  }

  // props 代理：rerender 合并写入 → Harness render 展开（追踪全部键）→
  // 子组件收到新 props 后按 propsChanged 更新
  const state = reactive<any>({ ...(options?.props ?? {}) })
  const Harness = defineComponent(function () {
    return () => ({
      $$typeof: Symbol.for('react.element'),
      type: component,
      key: null,
      ref: null,
      props: { ...state }
    })
  })
  createApp(Harness).mount('#' + id)

  const queries = buildQueries(container)

  return {
    container,
    unmount: () => {
      container.remove()
      const i = mountedContainers.indexOf(container)
      if (i >= 0) mountedContainers.splice(i, 1)
    },
    rerender: (props) => {
      Object.assign(state, props)
    },
    ...queries
  }
}

/** 卸载全部 render 挂载的组件（测试用例间清理） */
export function cleanup(): void {
  for (const c of mountedContainers.splice(0)) {
    c.remove()
  }
}

// ------------------------------------------------------------
// fireEvent — 触发 DOM 事件
// ------------------------------------------------------------

export interface FireEventOptions {
  /** input/change 等事件的目标值（设置 el.value 后派发） */
  value?: string | number
  bubbles?: boolean
}

/** 触发事件：fireEvent(el, 'click') / fireEvent(el, 'input', { value: 'x' }) */
export function fireEvent(
  el: Element | null,
  event: string,
  options: FireEventOptions = {}
): void {
  if (!el) throw new Error(`[testing] fireEvent: 目标元素不存在`)
  if (options.value != null && 'value' in el) {
    ;(el as any).value = options.value
  }
  el.dispatchEvent(new Event(event, { bubbles: options.bubbles ?? true }))
}

// ------------------------------------------------------------
// waitFor — 轮询等待异步更新
// ------------------------------------------------------------

export interface WaitForOptions {
  timeout?: number
  interval?: number
}

/** 轮询执行 cb（断言），直到不再抛错或超时 */
export async function waitFor(
  cb: () => void | Promise<void>,
  options: WaitForOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 1000
  const interval = options.interval ?? 20
  const start = Date.now()
  let lastErr: any = null
  for (;;) {
    try {
      await cb()
      return
    } catch (e) {
      lastErr = e
      if (Date.now() - start >= timeout) break
      await new Promise((r) => setTimeout(r, interval))
    }
  }
  throw lastErr ?? new Error('[testing] waitFor 超时')
}

// ------------------------------------------------------------
// screen — 全局查询（作用于最近 render 的 container）
// ------------------------------------------------------------

function currentContainer(): HTMLElement {
  const c = mountedContainers[mountedContainers.length - 1]
  if (!c) throw new Error('[testing] screen 需要在 render 之后使用')
  return c
}

/** 全局查询入口：screen.getByText / screen.queryByClass 等（作用于最近 render 的 container） */
export const screen: Omit<RenderResult, 'container' | 'unmount'> = new Proxy(
  {} as any,
  {
    get(_target, prop: string) {
      const queries = buildQueries(currentContainer())
      return (queries as any)[prop]
    }
  }
)
