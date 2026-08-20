// ============================================================
// watch onCleanup 在组件卸载时的行为验收（案例 7 推论验证）
//   场景 A：默认 flush（pre）→ 卸载时 onCleanup 不调用
//   场景 B：flush: 'sync' → 卸载时 onCleanup 仍不调用
// 根因：scope.stop() 只调 effect.stop()（不调 watch 的 stop 闭包），
//   watch 的 cleanup 只在自身 stop() 里执行 → 卸载清理必须显式
//   onUnmounted / onScopeDispose，或 onUnmounted(watchStop) 复用 onCleanup
// 运行：pnpm exec vitest run test/watch-cleanup.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, watch } from 'actview'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'wc-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('watch onCleanup 卸载行为', () => {
  it('场景 A：默认 flush（pre）→ 卸载时 onCleanup 不调用', async () => {
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
      return () => <div class="a">{state.n}</div>
    }
    function App() {
      return () => (state.show ? <Item /> : <div class="empty" />)
    }
    const host = mount(App)
    state.n = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(cleaned).toBe(false) // 第一次回调：只注册 cleanup
    state.n = 2
    await new Promise((r) => setTimeout(r, 0))
    expect(cleaned).toBe(true) // 第二次回调：先执行旧 cleanup ✓
    cleaned = false
    state.show = false // 卸载
    await new Promise((r) => setTimeout(r, 0))
    expect(cleaned).toBe(false) // 卸载时 onCleanup 不调用 ✓
  })

  it('场景 B：flush: sync → 卸载时 onCleanup 不调用', async () => {
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
      return () => <div class="b">{state.n}</div>
    }
    function App() {
      return () => (state.show ? <Item /> : <div class="empty" />)
    }
    const host = mount(App)
    state.n = 1
    expect(cleaned).toBe(false) // 第一次回调：只注册
    state.n = 2
    expect(cleaned).toBe(true) // sync：立即重跑 → 先执行旧 cleanup ✓
    cleaned = false
    state.show = false // 卸载
    await new Promise((r) => setTimeout(r, 0))
    expect(cleaned).toBe(false) // 即使 sync，卸载时 onCleanup 仍不调用 ✓
  })
})
