// ============================================================
// 基本响应式渲染（拆分自 test/verify.test.tsx）
// 运行：pnpm exec vitest run test/renderer/basic-render.test.tsx
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
// 场景 1：响应式文本自动更新（来源 verify 场景 1）
// ------------------------------------------------------------
describe('场景 1：响应式文本自动更新', () => {
  it('reactive 状态变化自动重跑 patch 更新 DOM', async () => {
    const state = reactive({ count: 1 })
    function App() {
      return (
        <div class="app">
          <span>hello: {state.count}</span>
          <input value={state.count} />
        </div>
      )
    }
    const host = mount('#s1', App)
    expect(collectText(host)).toContain('hello: 1')
    state.count = 42
    await nextTick()
    expect(collectText(host)).toContain('hello: 42')
    expect((host.children[0].children[1] as HTMLInputElement).value).toBe('42')
  })
})