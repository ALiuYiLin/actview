// ============================================================
// keyed diff / 同索引 diff / Fragment 根组件（拆分自 test/verify.test.tsx）
//   场景 2 + 场景 18 + 场景 26
// 运行：pnpm exec vitest run test/renderer/keyed-diff.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, unrefs, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, provide, useInjects, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from 'actview'
import { jsx } from '@actview/jsx'
import { patch } from '@actview/core'
import { runEffect } from '@actview/core'
import { createRouter, createMemoryHistory, RouterLink, RouterView } from '@actview/router'

/** 创建带 id 的宿主元素并挂载组件 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 场景 2：keyed diff（来源 verify 场景 2）
// ------------------------------------------------------------
describe('场景 2：keyed diff', () => {
  it('按 key 复用 / 重排 / 增删', async () => {
    const state = reactive({ items: ['a', 'b', 'c'] })
    function ListApp() {
      return (
        <ul>
          {state.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
    }
    const host = mount('#s2', ListApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)
    expect(texts()).toEqual(['a', 'b', 'c'])
    const liA = ul.children[0] // 'a' 的 DOM 节点（用于复用断言）

    // 重排 c,a,b：LIS = [a,b]，只移动 c（insertBefore 恰好 1 次，不是整体重排）
    const insertSpy = vi.spyOn(ul, 'insertBefore')
    state.items = ['c', 'a', 'b']
    await nextTick()
    expect(texts()).toEqual(['c', 'a', 'b'])
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(ul.children[1]).toBe(liA) // 'a' 的 li 复用，未被重建
    insertSpy.mockRestore()

    state.items = ['a', 'd']
    await nextTick()
    expect(texts()).toEqual(['a', 'd'])

    state.items = ['x', 'a', 'd']
    await nextTick()
    expect(texts()).toEqual(['x', 'a', 'd'])
  })

  it('4 元素重排只移动最小节点数', async () => {
    const state = reactive({ items: ['a', 'b', 'c', 'd'] })
    function ListApp() {
      return (
        <ul>
          {state.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
    }
    const host = mount('#s2b', ListApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)
    expect(texts()).toEqual(['a', 'b', 'c', 'd'])

    // a,b,c,d → a,c,d,b：LIS = [a,c,d]（旧下标 0,2,3），仅 b 需移动
    const insertSpy = vi.spyOn(ul, 'insertBefore')
    state.items = ['a', 'c', 'd', 'b']
    await nextTick()
    expect(texts()).toEqual(['a', 'c', 'd', 'b'])
    expect(insertSpy).toHaveBeenCalledTimes(1)
    insertSpy.mockRestore()

    // 全部逆序：a,c,d,b → b,d,c,a，至少 3 次移动但不超过列表长度
    const spy2 = vi.spyOn(ul, 'insertBefore')
    state.items = ['b', 'd', 'c', 'a']
    await nextTick()
    expect(texts()).toEqual(['b', 'd', 'c', 'a'])
    expect(spy2.mock.calls.length).toBeLessThan(4)
    spy2.mockRestore()
  })
})

// ------------------------------------------------------------
// 场景 18：同索引 diff 文本定位（来源 verify 场景 18）
// ------------------------------------------------------------
describe('场景 18：同索引 diff 文本定位', () => {
  it('Fragment 混排更新不再错位（Bug 3）', async () => {
    const state = reactive({ n: 1 })
    function App() {
      return <div><span>A</span><>{[state.n, 'B']}</><span>C</span></div>
    }
    const host = mount('#s18a', App)
    expect(collectText(host)).toBe('A1BC')

    state.n = 99
    await nextTick()
    expect(collectText(host)).toBe('A99BC') // 修复前错误为 '99BBC'
    expect((host.children[0].children[0] as HTMLElement).textContent).toBe('A') // spanA 未被误改
  })

  it('纯文本数组增删中间项显示与节点数正确（Bug 2）', async () => {
    const state = reactive({ list: ['a', 'b', 'c'] })
    function App() {
      return <div>{state.list}</div>
    }
    const host = mount('#s18b', App)
    expect(host.children[0].textContent).toBe('abc')

    state.list = ['a', 'x', 'b', 'c']
    await nextTick()
    expect(host.children[0].textContent).toBe('axbc')

    state.list = ['a', 'x'] // 删除尾部：多余文本节点被移除
    await nextTick()
    expect(host.children[0].textContent).toBe('ax')
    expect(host.children[0].childNodes.length).toBe(2)
  })

  it('无 key 元素列表保持标准行为（文本正确、节点按索引复用）', async () => {
    const state = reactive({ list: ['a', 'b', 'c'] })
    function App() {
      return <ul>{state.list.map((i) => <li>{i}</li>)}</ul>
    }
    const host = mount('#s18c', App)
    const ul = host.children[0]
    const liA = ul.children[0]

    state.list = ['a', 'x', 'b', 'c']
    await nextTick()
    expect(Array.from(ul.children).map((li) => li.textContent).join(',')).toBe('a,x,b,c')
    expect(ul.children.length).toBe(4)
    expect(ul.children[0]).toBe(liA) // 首项复用（无 key 的标准索引语义）
  })
})

// ------------------------------------------------------------
// 场景 26：keyed diff — Fragment 根组件（来源 verify 场景 26）
// ------------------------------------------------------------
describe('场景 26：keyed diff Fragment 根组件', () => {
  const Group = defineComponent((props: any) => {
    return () => (
      <>
        <div class="group-item">{props.text}</div>
      </>
    )
  })

  it('带 key 的 Fragment 根组件正常挂载（不再丢失）', () => {
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group key={0} text="G" />
        </div>
      )
    }
    const host = mount('#s26a', App)
    const item = host.querySelector('.group-item')
    expect(item).not.toBeNull()
    expect(item!.textContent).toBe('G')
    // 顺序：label 在 group-item 前
    expect(host.textContent).toContain('LG')
  })

  it('对照：去掉 key 走普通 patch 也正常', () => {
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group text="G" />
        </div>
      )
    }
    const host = mount('#s26b', App)
    expect(host.querySelector('.group-item')?.textContent).toBe('G')
  })

  it('key 交换重排：Fragment 根组件参与移动，DOM 顺序正确无重复', async () => {
    const state = reactive({ order: [0, 1, 2] })
    function App() {
      return (
        <div id="s26c">
          {state.order.map((i) => (
            <Group key={i} text={'G' + i} />
          ))}
        </div>
      )
    }
    const host = mount('#s26c', App)
    const texts = () => Array.from(host.querySelectorAll('.group-item')).map((n) => n.textContent)

    expect(texts()).toEqual(['G0', 'G1', 'G2'])

    // 交换 0 与 2
    state.order = [2, 1, 0]
    await nextTick()
    expect(texts()).toEqual(['G2', 'G1', 'G0'])

    // 增删：头部插入 + 删除尾部
    state.order = [3, 2, 1]
    await nextTick()
    expect(texts()).toEqual(['G3', 'G2', 'G1'])

    // 无重复、无丢失
    const flat = texts().join(',')
    expect(new Set(texts()).size).toBe(texts().length)
    expect(flat).toContain('G3')
    expect(flat).not.toContain('G0')
  })

  it('Fragment 根组件与普通元素混排（相邻兄弟是 Fragment 根 =》 anchor 正确）', async () => {
    const state = reactive({ flip: false })
    const A = defineComponent((_p: any) => () => (
      <>
        <i class="a1">A1</i>
        <i class="a2">A2</i>
      </>
    ))
    const B = defineComponent((_p: any) => () => (
      <>
        <b class="b1">B1</b>
      </>
    ))
    function App() {
      return (
        <div id="s26d">
          {state.flip ? <B key={1} /> : <A key={1} />}
          <span class="tail">T</span>
        </div>
      )
    }
    void 0
    const host = mount('#s26d', App)
    expect(host.textContent).toContain('A1A2T')

    state.flip = true
    await nextTick()
    // A（Fragment 双节点）被 B 替换，tail 仍在其后
    expect(host.textContent).toContain('B1T')
    expect(host.querySelector('.a1')).toBeNull()
    expect(host.querySelector('.a2')).toBeNull()
  })

  it('嵌套 keyed：Fragment 根组件内部含 keyed children 不崩溃、完整挂载', () => {
    // 回归：未命中 oldKeyToIndex 的新节点挂到 null 容器时，内层
    // patchKeyedChildren 的 insertBefore(container=null) 会 TypeError。
    // 修复：新节点直接挂到真实 container（参照 Vue），插入阶段仅调整顺序。
    const Group = defineComponent((props: any) => {
      return () => (
        <>
          {[0, 1].map((i) => (
            <span key={i} class="inner">
              G{props.text}-{i}
            </span>
          ))}
        </>
      )
    })
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group key={0} text="A" />
          <Group key={1} text="B" />
        </div>
      )
    }
    const host = mount('#s26e', App)
    const inners = Array.from(host.querySelectorAll('.inner')).map((n) => n.textContent)
    expect(inners).toEqual(['GA-0', 'GA-1', 'GB-0', 'GB-1'])
    expect(host.querySelectorAll('.inner').length).toBe(4)
  })
})