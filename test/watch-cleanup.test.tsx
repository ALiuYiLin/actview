// ============================================================
// watch onCleanup 在组件卸载时的行为验收（Vue 3 语义）
//   场景 A：默认 flush（pre）→ 卸载时 onCleanup 调用
//   场景 B：flush: 'sync' → 卸载时 onCleanup 调用
//   场景 C：watch.stop() 手动停止 → cleanup 执行且幂等（不重复）
//   场景 D：watchEffect 的 onWatcherCleanup 卸载时执行
// 机制：ReactiveEffect.onStop 钩子（Vue 3）——watch/watchEffect 把 cleanup
//   挂在 effect.onStop 上，scope.stop() → effect.stop() → onStop → cleanup
// 运行：pnpm exec vitest run test/watch-cleanup.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, watch, watchEffect, onWatcherCleanup } from '@actview/core'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'wc-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('watch onCleanup 卸载行为', () => {
  it('场景 A：默认 flush（pre）→ 卸载时 onCleanup 调用', async () => {
    let cleaned = false
    const state = reactive({ show: true, n: 0 })
    function Item() {
      watch(
        () => state.n,
        (_v, _o, onCleanup) => {
          onCleanup(() => {
            cleaned = true
          })
        }
      )
      return <div class="a">{state.n}</div>
    }
    function App() {
      return state.show ? <Item /> : <div class="empty" />
    }
    const host = mount(App)
    state.n = 1
    await flush()
    expect(cleaned).toBe(false) // 第一次回调：只注册 cleanup
    state.n = 2
    await flush()
    expect(cleaned).toBe(true) // 第二次回调：先执行旧 cleanup ✓
    cleaned = false
    state.show = false // 卸载
    await flush()
    expect(cleaned).toBe(true) // 卸载时 onCleanup 调用（Vue 3 语义）✓
  })

  it('场景 B：flush: sync → 卸载时 onCleanup 调用', async () => {
    let cleaned = false
    const state = reactive({ show: true, n: 0 })
    function Item() {
      watch(
        () => state.n,
        (_v, _o, onCleanup) => {
          onCleanup(() => {
            cleaned = true
          })
        },
        { flush: 'sync' }
      )
      return <div class="b">{state.n}</div>
    }
    function App() {
      return state.show ? <Item /> : <div class="empty" />
    }
    const host = mount(App)
    state.n = 1
    expect(cleaned).toBe(false) // 第一次回调：只注册
    state.n = 2
    expect(cleaned).toBe(true) // sync：立即重跑 → 先执行旧 cleanup ✓
    cleaned = false
    state.show = false // 卸载
    await flush()
    expect(cleaned).toBe(true) // 卸载时 onCleanup 调用 ✓
  })

  it('场景 C：watch.stop() 手动停止 → cleanup 执行且幂等', async () => {
    let cleaned = 0
    const state = reactive({ n: 0 })
    const stop = watch(
      () => state.n,
      (_v, _o, onCleanup) => {
        onCleanup(() => cleaned++)
      }
    )
    state.n = 1
    await flush()
    expect(cleaned).toBe(0) // 第一次回调：只注册

    stop()
    expect(cleaned).toBe(1) // stop() → effect.stop() → onStop → cleanup ✓
    stop() // 幂等：active 已 false，effect.stop() 短路，不重复执行
    expect(cleaned).toBe(1)
  })

  it('场景 D：watchEffect onWatcherCleanup 卸载时执行', async () => {
    let cleaned = false
    const state = reactive({ show: true, n: 0 })
    function Item() {
      watchEffect(() => {
        state.n
        onWatcherCleanup(() => {
          cleaned = true
        })
      })
      return <div class="d">{state.n}</div>
    }
    function App() {
      return state.show ? <Item /> : <div class="empty" />
    }
    const host = mount(App)
    expect(cleaned).toBe(false) // 挂载时首次同步执行：只注册，未执行
    state.n = 1
    await flush()
    expect(cleaned).toBe(true) // 第二次执行：先跑旧 cleanup ✓
    cleaned = false
    state.show = false // 卸载
    await flush()
    expect(cleaned).toBe(true) // 卸载时执行 ✓
  })
})
