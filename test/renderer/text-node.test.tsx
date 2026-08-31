// ============================================================
// 空文本节点（Bug 4：不残留空文本节点）（拆分自 test/verify.test.tsx）
// 运行：pnpm exec vitest run test/renderer/text-node.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, unrefs, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, provide, useInjects, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from '@actview/core'
import { jsx } from '@actview/jsx'
import { patch } from '@actview/core'
import { runEffect } from '@actview/core'

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
// 场景 19：空文本节点（Bug 4：不残留空文本节点）（来源 verify 场景 19）
// ------------------------------------------------------------
describe('场景 19：空文本节点', () => {
  it('文本置空后移除节点、恢复后重建', async () => {
    const state = reactive({ s: 'abc' })
    function App() {
      return <div>{state.s}</div>
    }
    const host = mount('#s19a', App)
    const div = host.children[0]
    expect(div.textContent).toBe('abc')
    expect(div.childNodes.length).toBe(1)

    state.s = '' // 置空：移除空文本节点，不残留
    await nextTick()
    expect(div.textContent).toBe('')
    expect(div.childNodes.length).toBe(0) // 修复前残留 1 个空文本节点

    state.s = 'xyz' // 恢复：重新创建文本节点
    await nextTick()
    expect(div.textContent).toBe('xyz')
    expect(div.childNodes.length).toBe(1)
  })

  it('首次挂载即空文本不创建节点', () => {
    const state = reactive({ s: '' })
    function App() {
      return <div>{state.s}</div>
    }
    const host = mount('#s19b', App)
    expect(host.children[0].childNodes.length).toBe(0)
  })

  it('列表中间空文本增删后其余项不错位', async () => {
    const state = reactive({ list: ['a', '', 'b'] })
    function App() {
      return <div>{state.list}</div>
    }
    const host = mount('#s19c', App)
    const div = host.children[0]
    expect(div.childNodes.length).toBe(2) // 中间空文本不建节点

    state.list = ['a', 'x', 'b'] // 空文本位置插入 x：锚点为 childNodes[1]（b）
    await nextTick()
    expect(div.textContent).toBe('axb')

    state.list = ['a', 'x', 'b', 'c'] // 尾部追加
    await nextTick()
    expect(div.textContent).toBe('axbc')
    expect(div.childNodes.length).toBe(4)
  })
})