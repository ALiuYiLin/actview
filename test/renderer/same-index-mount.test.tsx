// ============================================================
// 同索引 diff：oldVnode==null 分支的 anchor 缺陷（回归）
//   旧 [null, button, null] → 新 [guard, button, guard]：
//   patch 的 mount 分支未传 anchor → 新节点 append 到末尾，
//   而非插入同索引位置（React 参考顺序 [guard, button, guard]）
// 运行：pnpm exec vitest run test/renderer/same-index-mount.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, lazy, reactive } from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'sim-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('同索引 diff：空位变实节点（anchor 插入）', () => {
  it('旧 [null, button, null] → 新 [g0, button, g2]：g0 插到 button 前', async () => {
    const state = reactive({ g0: false, g2: false })
    function App() {
      return (
        <div class="list">
          {state.g0 ? <span class="g0">g0</span> : null}
          <button class="btn">b</button>
          {state.g2 ? <span class="g2">g2</span> : null}
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    expect(list.children.length).toBe(1) // [button]

    // 两端空位同时变成实际节点 → 同索引 diff 挂载新节点
    state.g0 = true
    state.g2 = true
    await flush()

    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g0', 'btn', 'g2']) // 插入正确位置而非 append 末尾
  })

  it('头部插入：旧 [button, b2] → 新 [g, button, b2]，g 应插到最前', async () => {
    const state = reactive({ show: false })
    function App() {
      return (
        <div class="list">
          {state.show ? <span class="g">g</span> : null}
          <button class="b1">1</button>
          <button class="b2">2</button>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.show = true
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g', 'b1', 'b2'])
  })
})

// ------------------------------------------------------------
// lazy 组件：首次渲染 null、加载后 subtree 从 null → 实节点的挂载位置
// ------------------------------------------------------------
describe('同索引 diff：lazy 组件加载后挂载位置', () => {
  it('[lazySpan, div, lazySpan] → 加载完成渲染 [ls, mid, ls]（不堆到末尾）', async () => {
    function LazySpan() {
      return <span class="ls">L</span>
    }
    const LazyA = lazy(() => Promise.resolve({ default: LazySpan }))
    function App() {
      return (
        <div class="list">
          <LazyA />
          <div class="mid">M</div>
          <LazyA />
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    // lazy 未加载：渲染 null 占位 → 仅 mid
    expect(Array.from(list.children).map((c) => c.className)).toEqual(['mid'])
    // 等待 lazy 加载完成（Promise 链 + 组件更新 flush）
    for (let i = 0; i < 10 && list.querySelectorAll('.ls').length < 2; i++) {
      await flush()
    }
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['ls', 'mid', 'ls'])
  })

  it('lazy 在 keyed 列表中的加载位置', async () => {
    function LazySpan() {
      return <span class="ls">L</span>
    }
    const LazyA = lazy(() => Promise.resolve({ default: LazySpan }))
    function App() {
      return (
        <ul class="list">
          <li key="a">
            <LazyA />
          </li>
          <li key="b">B</li>
          <li key="c">
            <LazyA />
          </li>
        </ul>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    for (let i = 0; i < 10 && list.querySelectorAll('.ls').length < 2; i++) {
      await flush()
    }
    const items = Array.from(list.children).map((li) => li.textContent)
    expect(items).toEqual(['L', 'B', 'L'])
  })
})
