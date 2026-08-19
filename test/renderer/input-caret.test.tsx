// ============================================================
// 受控 input 光标保位（拆分自 test/verify.test.tsx）
// 运行：pnpm exec vitest run test/renderer/input-caret.test.tsx
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
// 场景 9：受控 input 光标保位（来源 verify 场景 9）
// ------------------------------------------------------------
describe('场景 9：受控 input 光标保位', () => {
  it('聚焦时赋值后恢复光标，未聚焦不干预', async () => {
    const state = reactive({ text: 'abc' })
    function InputApp() {
      return (
        <div class="input-app">
          <input value={state.text} oninput={(e) => { state.text = e.target.value }} />
        </div>
      )
    }
    const host = mount('#s9', InputApp)
    const inputEl = host.children[0].children[0] as HTMLInputElement
    expect(inputEl.value).toBe('abc')

    // 聚焦：光标在位置 1，state 值变化 => patch 赋值后光标保持
    inputEl.focus()
    inputEl.setSelectionRange(1, 1)
    state.text = 'aXc'
    await nextTick()
    expect(inputEl.value).toBe('aXc')
    expect(inputEl.selectionStart).toBe(1)

    // 未聚焦：value 更新但光标不被恢复逻辑干预（happy-dom 与真实浏览器一致：
    // 赋值后光标重置，此处为末尾 4；关键是未被还原成记录值 2）
    ;(document.activeElement as HTMLElement)?.blur()
    inputEl.value = 'aXc'
    inputEl.setSelectionRange(2, 2)
    state.text = 'abXc'
    await nextTick()
    expect(inputEl.value).toBe('abXc')
    expect(inputEl.selectionStart).not.toBe(2)
  })
})