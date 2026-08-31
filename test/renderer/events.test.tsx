// ============================================================
// 事件系统测试（拆分自 test/verify.test.tsx + test/p0.test.tsx）
//   场景 11（verify）+ P0: passive 事件修饰符
// 运行：pnpm exec vitest run test/renderer/events.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, unrefs, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, provide, useInjects, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from '@actview/core'
import { jsx } from '@actview/jsx'
import { patch } from '@actview/core'
import { runEffect } from '@actview/core'

/** verify 风格 mount（2 参：containerId + component） */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** p0 风格 mount（1 参：仅 component，自动生成 id） */
let mountP0Seq = 0
function mountP0(component: any) {
  const host = document.createElement('div')
  host.id = 'ev-p0-host-' + mountP0Seq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 场景 11：事件系统（来源 verify 场景 11）
// ------------------------------------------------------------
describe('场景 11：事件系统', () => {
  it('绑定/capture/换 handler 不重绑/解绑', async () => {
    const state = reactive({ count: 0, enabled: true })
    function App() {
      return (
        <button
          onClick={state.enabled ? () => state.count++ : undefined}
          onMouseDownCapture={() => (state.count += 10)}
        >
          btn
        </button>
      )
    }

    // mount 后 spy 实例方法（happy-dom 事件方法在深层原型，原型 spy 不可靠）
    const host = mount('#s11', App)
    const btn = host.children[0] as HTMLButtonElement

    // 初始绑定生效（行为验证：dispatch 触发 handler）
    btn.dispatchEvent(new Event('click'))
    expect(state.count).toBe(1)
    btn.dispatchEvent(new Event('mousedown'))
    expect(state.count).toBe(11)

    // 重渲染：handler 换新闭包，invoker 复用 → 不重新 addEventListener
    const addSpy = vi.spyOn(btn, 'addEventListener')
    state.count = 100 // 触发 App 重渲染，onClick / onMouseDownCapture 均为新函数
    await nextTick()
    expect(addSpy).not.toHaveBeenCalled()

    // 解绑：enabled=false → onClick 移除并停止触发
    const removeSpy = vi.spyOn(btn, 'removeEventListener')
    state.enabled = false
    await nextTick()
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), false)
    btn.dispatchEvent(new Event('click'))
    expect(state.count).toBe(100) // click 不再 +1
    btn.dispatchEvent(new Event('mousedown'))
    expect(state.count).toBe(110) // mousedown 仍 +10

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ------------------------------------------------------------
// P0: passive 事件修饰符（来源 p0.test.tsx）
// ------------------------------------------------------------
describe('P0: passive 事件修饰符', () => {
  it('onScrollPassive 以 passive 监听', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    function App() {
      return <div onScrollPassive={() => {}} />
    }
    mountP0(App)
    const call = spy.mock.calls.find(
      ([type]) => type === 'scroll'
    ) as unknown as [string, any, any]
    expect(call).toBeTruthy()
    expect(call[2]).toEqual({ capture: false, passive: true })
    spy.mockRestore()
  })

  it('onClick 仍为普通监听（无 passive）', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    function App() {
      return <div onClick={() => {}} />
    }
    mountP0(App)
    const call = spy.mock.calls.find(
      ([type]) => type === 'click'
    ) as unknown as [string, any, any]
    expect(call).toBeTruthy()
    expect(call[2]).toEqual({ capture: false, passive: false })
    spy.mockRestore()
  })
})