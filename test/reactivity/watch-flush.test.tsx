// ============================================================
// watch immediate + flush 语义（整文件移动自 test/watch-flush.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/watch-flush.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, watch, watchEffect, nextTick } from 'actview'

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'wf-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('watch immediate + flush（Vue 3 语义）', () => {
  it('immediate + flush:post：首次回调同步执行（mount 返回前已触发）', () => {
    const cbLog: string[] = []
    const state = reactive({ disabled: true })

    function App() {
      watch(
        () => state.disabled,
        (v) => cbLog.push(`cb:disabled=${v}`),
        { immediate: true, flush: 'post' }, // post 不影响 immediate 首次
      )
      return <button disabled={state.disabled}>x</button>
    }

    mount(App)
    // 同步执行：mount 完成后立即可见（而非 defer 到微任务）
    expect(cbLog).toEqual(['cb:disabled=true'])
  })

  it('immediate 首次回调时 DOM refs 尚未就绪（AI-001 场景证据）', () => {
    const elRef = ref<HTMLElement | null>(null)
    const seen: Array<string | null> = []
    const state = reactive({ disabled: true })

    function App() {
      watch(
        () => state.disabled,
        () => seen.push(elRef.value), // setup 期 DOM 未挂载 → elRef 为 null
        { immediate: true, flush: 'post' },
      )
      return <div ref={elRef} />
    }

    mount(App)
    expect(seen).toEqual([null]) // 首次回调拿不到 DOM → 初始态 DOM 处理须走 onMounted
    expect(elRef.value).not.toBeNull() // mount 完成后 ref 才就绪
  })

  it('后续 trigger 走 flush:post 异步链（DOM 提交后）', async () => {
    const order: string[] = []
    const state = reactive({ n: 1 })

    function App() {
      watch(
        () => state.n,
        () => order.push('watch'),
        { flush: 'post' },
      )
      return <div />
    }

    mount(App)
    state.n = 2
    // post：不在同步/首个微任务触发，等 nextTick 链
    order.push('sync-after-set')
    await nextTick()
    await nextTick()
    expect(order).toEqual(['sync-after-set', 'watch'])
  })

  it('watchEffect flush:post：首次同步执行，后续 trigger 异步', async () => {
    const cbLog: string[] = []
    const state = reactive({ count: 0 })

    function App() {
      watchEffect(
        () => {
          void state.count
          cbLog.push(`eff:count=${state.count}`)
        },
        { flush: 'post' },
      )
      return <div />
    }

    mount(App)
    // 首次同步（Vue 3 语义：watchEffect 总是立即执行一次）
    expect(cbLog).toEqual(['eff:count=0'])

    state.count = 1
    await nextTick()
    await nextTick()
    expect(cbLog).toEqual(['eff:count=0', 'eff:count=1'])
  })
})