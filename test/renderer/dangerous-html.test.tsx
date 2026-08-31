// ============================================================
// dangerouslySetInnerHTML（拆分自 test/p0.test.tsx）
// 运行：pnpm exec vitest run test/renderer/dangerous-html.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  ref,
  shallowRef,
  triggerRef,
  watch,
  watchEffect,
  onWatcherCleanup,
  effectScope,
  onScopeDispose,
  toValue,
  computed,
  nextTick,
  createApp
} from '@actview/core'
import { runEffect } from '@actview/core'

/** 等待所有微任务（含定时器）执行完毕，用于异步 watch */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** 创建带唯一 id 的宿主元素并挂载组件（避免 querySelector 命中旧 host） */
let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'dh-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// P0: dangerouslySetInnerHTML（来源 p0.test.tsx）
// ------------------------------------------------------------
describe('P0: dangerouslySetInnerHTML', () => {
  it('注入 HTML 字符串', () => {
    function App() {
      return <div dangerouslySetInnerHTML={{ __html: '<span class="x">hi</span>' }} />
    }
    const host = mount(App)
    const span = host.querySelector('.x')!
    expect(span.textContent).toBe('hi')
    expect(span.tagName.toLowerCase()).toBe('span')
  })

  it('更新 innerHTML 时替换内容', () => {
    const state = reactive({ html: '<b>a</b>' })
    function App() {
      return <div dangerouslySetInnerHTML={{ __html: state.html }} />
    }
    const host = mount(App)
    expect(host.querySelector('b')!.textContent).toBe('a')
    state.html = '<i>b</i>'
    return Promise.resolve().then(() => {
      expect(host.querySelector('i')!.textContent).toBe('b')
      expect(host.querySelector('b')).toBe(null)
    })
  })
})