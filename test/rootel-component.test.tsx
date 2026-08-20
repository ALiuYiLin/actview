// ============================================================
// useRootElement 对组件根的取值验收：根是组件时仍指向最终根 DOM
//   覆盖：组件根（CompositeItem→button）/ 元素根 / 条件切换根（onUpdated 同步）
// 运行：pnpm exec vitest run test/rootel-component.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, useRootElement } from 'actview'

// Toggle →（group 分支）→ CompositeItem（组件）→ button
function CompositeItem(props: any) {
  return () => <button class="real-btn">{props.children}</button>
}

function Toggle(props: any) {
  const rootRef = useRootElement()
  // 把 ref 对象传出去，测试直接读 .value（onMounted/onUpdated 同步后即为最新）
  props.onRootRef?.(rootRef)

  return () => {
    if (props.inGroup) {
      // 组件根分支：rootRef 应指向最终根 DOM（button），而非 CompositeItem 实例
      return <CompositeItem>{props.children}</CompositeItem>
    }
    return <button class="solo-btn">{props.children}</button>
  }
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'se-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('useRootElement 组件根取值', () => {
  it('根是组件（CompositeItem→button）：rootRef = 最终根 DOM（不是组件实例）', () => {
    let rootRef: any = null
    function App() {
      return (
        <Toggle inGroup={true} onRootRef={(r: any) => (rootRef = r)}>
          label
        </Toggle>
      )
    }
    const host = mount(App)
    const btn = host.querySelector('.real-btn')!
    expect(btn.textContent).toBe('label')
    expect(rootRef.value).toBe(btn) // 关键：指向 button DOM，而非 CompositeItem 实例
    expect(rootRef.value?.tagName).toBe('BUTTON')
  })

  it('根是元素（button）：rootRef = 自身 DOM', () => {
    let rootRef: any = null
    function App() {
      return (
        <Toggle inGroup={false} onRootRef={(r: any) => (rootRef = r)}>
          solo
        </Toggle>
      )
    }
    const host = mount(App)
    expect(rootRef.value).toBe(host.querySelector('.solo-btn'))
  })

  it('条件切换根（元素↔组件）：onUpdated 重新同步', async () => {
    const state = reactive({ g: true })
    let rootRef: any = null
    function App() {
      return (
        <Toggle inGroup={state.g} onRootRef={(r: any) => (rootRef = r)}>
          x
        </Toggle>
      )
    }
    const host = mount(App)
    expect(rootRef.value?.classList.contains('real-btn')).toBe(true)
    state.g = false
    await new Promise((r) => setTimeout(r, 0))
    expect(rootRef.value?.classList.contains('solo-btn')).toBe(true)
  })
})
