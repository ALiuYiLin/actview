// ============================================================
// 验证：sameIndexAnchor 修复（1.4.4）在动态列表 / portal 条件渲染 /
// 组件卸载重挂场景是否破坏节点归属
//   （预期：insertBefore anchor 已不在容器下 → NotFoundError；
//     patchProps 拿到已卸载 el → Cannot read 'style'）
// 只验证不改代码。运行：pnpm exec vitest run test/renderer/same-index-anchor-regression.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive } from '@actview/core'
import { Teleport } from '@actview/core'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'anchor-reg-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// 场景 1：动态列表——空位变实节点 + 后兄弟被卸载/移动
// ------------------------------------------------------------
describe('sameIndexAnchor 回归：动态列表', () => {
  it('头部空位补实节点 + 尾部项被删（同轮）', async () => {
    const state = reactive({ g: false, show: true })
    function App() {
      return (
        <div class="list">
          {state.g ? <span class="g">G</span> : null}
          <button class="b">B</button>
          {state.show ? <button class="c">C</button> : null}
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    // 同时：头部空位变实节点 + 尾部项卸载
    state.g = true
    state.show = false
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g', 'b'])
  })

  it('空位补实节点 + 中间项被替换（同轮 diff）', async () => {
    const state = reactive({ g: false, alt: false })
    function App() {
      return (
        <div class="list">
          {state.g ? <span class="g">G</span> : null}
          {state.alt ? <span class="alt">ALT</span> : <button class="b">B</button>}
          <button class="c">C</button>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.g = true
    state.alt = true
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g', 'alt', 'c'])
  })
})

// ------------------------------------------------------------
// 场景 2：Teleport portal 条件渲染——空位变实节点时 anchor 取自 portal 内容
// ------------------------------------------------------------
describe('sameIndexAnchor 回归：Teleport portal', () => {
  it('空位补实节点 + 后兄弟是 Teleport（内容在 target，不在本容器）', async () => {
    const target = document.createElement('div')
    target.id = 'anchor-target'
    document.body.appendChild(target)

    const state = reactive({ g: false })
    function App() {
      return (
        <div class="list">
          {state.g ? <span class="g">G</span> : null}
          <Teleport to="#anchor-target">
            <span class="tp">T</span>
          </Teleport>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    // 首帧：空位(null) + Teleport（其 DOM 在 #anchor-target）
    expect(target.querySelector('.tp')).toBeTruthy()

    // 空位变实节点：sameIndexAnchor 会取 Teleport vnode 的 firstDomEl 作 anchor，
    // 而该 DOM 在 #anchor-target 下、不在 .list 下 → insertBefore 应抛 NotFoundError
    state.g = true
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g'])
    target.remove()
  })
})

// ------------------------------------------------------------
// 场景 3：组件卸载重挂——空位补实节点时 anchor 指向已卸载组件的 detached DOM
// ------------------------------------------------------------
describe('sameIndexAnchor 回归：组件卸载重挂', () => {
  it('组件卸载后头部空位补实节点（anchor 指向 detached DOM）', async () => {
    const state = reactive({ show: true, g: false })
    function Panel() {
      return <span class="p">P</span>
    }
    function App() {
      return (
        <div class="list">
          {state.g ? <span class="g">G</span> : null}
          {state.show ? <Panel /> : null}
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    // 首帧 [null, Panel] → DOM [span.p]
    expect(Array.from(list.children).map((c) => c.className)).toEqual(['p'])

    // 1) Panel 卸载：children [null, null] → DOM []
    state.show = false
    await flush()
    expect(list.children.length).toBe(0)

    // 2) 头部空位变实节点：oldList 缓存 = [null, Panel(已卸载)]
    //    sameIndexAnchor → Panel vnode 的 el（detached）作 anchor →
    //    insertBefore 抛 NotFoundError（anchor 不在父下）
    state.g = true
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g'])
  })
})

// ------------------------------------------------------------
// 场景 4：patchProps 拿到已卸载 el（Cannot read 'style'）
// ------------------------------------------------------------
describe('sameIndexAnchor 回归：patchProps 已卸载 el', () => {
  it('列表尾部空位补实节点（旧列表含已卸载组件 vnode）', async () => {
    const state = reactive({ show: true, g: false })
    function Panel() {
      return <span class="p">P</span>
    }
    function App() {
      return (
        <div class="list">
          {state.show ? <Panel /> : null}
          {state.g ? <span class="g">G</span> : null}
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.show = false
    await flush()
    state.g = true
    await flush()
    const classes = Array.from(list.children).map((c) => c.className)
    expect(classes).toEqual(['g'])
  })
})
