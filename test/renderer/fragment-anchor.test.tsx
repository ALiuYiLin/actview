// ============================================================
// Step 4：Fragment 结束锚点——空 Fragment / 嵌套 Fragment / 纯文本
// Fragment 的挂载与替换位置（对齐 Vue fragmentEndAnchor 语义）
// 运行：pnpm exec vitest run test/renderer/fragment-anchor.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive } from '@actview/core'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'frag-anchor-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

/** 序列化 childNodes（跳过零宽空格锚点节点） */
function seq(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => !(n.nodeType === 3 && n.textContent === '\u200B'))
    .map((n) => (n.nodeType === 3 ? '#' + n.textContent : '<' + (n as Element).className + '>'))
    .join(',')
}

describe('Fragment 结束锚点（Step 4）', () => {
  it('空 Fragment 变实节点：替换位置正确（锚点不越界）', async () => {
    const state = reactive({ show: false })
    function App() {
      return (
        <div class="list">
          {state.show ? <span class="a">A</span> : <>{null}</>}
          <span class="b">B</span>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.show = true
    await flush()
    expect(seq(list)).toBe('<a>,<b>')
  })

  it('嵌套 Fragment + 文本混排的替换锚点', async () => {
    const state = reactive({ on: false })
    function App() {
      return (
        <div class="list">
          {state.on ? (
            <>{['X', <span class="x">X</span>, 'Y']}</>
          ) : (
            <>
              {'1'}
              <span class="m">M</span>
              {'2'}
            </>
          )}
          <span class="tail">T</span>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.on = true
    await flush()
    // 替换后 X 内容就位，tail 保持末尾
    expect(seq(list)).toBe('#X,<x>,#Y,<tail>')
  })

  it('Fragment 增长 children：新节点插到锚点前（不越过后续兄弟）', async () => {
    const state = reactive({ n: 0 })
    function App() {
      return (
        <div class="list">
          {state.n === 0 ? <>{'a'}</> : <>{['a', 'b']}</>}
          <span class="tail">T</span>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.n = 1
    await flush()
    expect(seq(list)).toBe('#a,#b,<tail>')
  })

  it('卸载 Fragment：锚点一并移除（无残留）', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div class="list">
          {state.show ? (<>{'a'}<span class="m">M</span></>) : null}
          <span class="tail">T</span>
        </div>
      )
    }
    const host = mount(App)
    const list = host.querySelector('.list')!
    state.show = false
    await flush()
    // 仅剩 tail，无零宽空格残留
    expect(seq(list)).toBe('<tail>')
    expect(list.childNodes.length).toBe(1)
  })
})
