// ============================================================
// keyed/unkeyed 混用回归（RadioGroup + Legend key 场景）
//   带 key 兄弟触发 keyed diff 时，无 key 子节点必须按相对顺序复用
//   无 key 旧节点（React 语义）——否则每次重渲染都被重新挂载，
//   DOM 元素被替换（缓存引用失效 + onUpdated 读到旧 DOM 链式错乱）
// 运行：pnpm exec vitest run test/renderer/keyed-unkeyed-mix.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref } from 'actview'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'km-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('keyed/unkeyed 混用', () => {
  it('带 key 兄弟触发 keyed diff → 无 key 子节点被重挂（元素替换）', async () => {
    const state = reactive({ n: 0, legend: 'a' })
    function Item(props: any) {
      return () => <div data-testid={props.tid}>{props.n}</div>
    }
    function App() {
      return () => (
        <div class="wrap">
          <span key={state.legend}>legend</span>
          <Item tid="unkeyed" n={state.n} />
        </div>
      )
    }
    const host = mount(App)
    const el1 = host.querySelector('[data-testid="unkeyed"]')!
    state.n = 1 // 只改无 key 子节点的 prop（keyed 兄弟不变）
    await new Promise((r) => setTimeout(r, 0))
    const el2 = host.querySelector('[data-testid="unkeyed"]')!
    console.log('[debug] same element:', el1 === el2, 'text:', el2.textContent)
    expect(el1 === el2).toBe(true) // React 语义：应原地更新
  })

  it('对照：全无 key → 位置 diff，原地更新', async () => {
    const state = reactive({ n: 0 })
    function Item(props: any) {
      return () => <div data-testid={props.tid}>{props.n}</div>
    }
    function App() {
      return () => (
        <div class="wrap">
          <span>legend</span>
          <Item tid="unkeyed2" n={state.n} />
        </div>
      )
    }
    const host = mount(App)
    const el1 = host.querySelector('[data-testid="unkeyed2"]')!
    state.n = 1
    await new Promise((r) => setTimeout(r, 0))
    const el2 = host.querySelector('[data-testid="unkeyed2"]')!
    expect(el1 === el2).toBe(true)
  })
})
