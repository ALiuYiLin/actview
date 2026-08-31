// ============================================================
// 调度批处理 + nextTick（拆分自 test/verify.test.tsx）
// 运行：pnpm exec vitest run test/renderer/scheduler.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, unrefs, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, provide, useInjects, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from '@actview/core'
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
// 场景 10：调度批处理 + nextTick（来源 verify 场景 10）
// ------------------------------------------------------------
describe('场景 10：调度批处理', () => {
  it('同轮多次修改状态只触发一次更新；nextTick 在更新后回调', async () => {
    let renderCount = 0
    function markRender() {
      renderCount++
      return ''
    }
    const state = reactive({ count: 0 })
    function Counter() {
      return <div class="counter">{markRender()}{state.count}</div>
    }
    const host = mount('#s10', Counter)
    expect(renderCount).toBe(1) // 首次挂载同步渲染

    state.count++
    state.count++
    state.count++
    expect(renderCount).toBe(1) // 批处理：修改后同步时刻尚未重渲染
    await nextTick()
    expect(renderCount).toBe(2) // 微任务中只更新一次（去重）
    expect(collectText(host)).toContain('3')

    let called = false
    state.count++
    await nextTick(() => { called = true })
    expect(called).toBe(true) // nextTick 回调在 flush 后执行
    expect(renderCount).toBe(3)
  })
})