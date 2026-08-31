// ============================================================
// watchEffect 测试（拆分自 verify.test.tsx 场景 24）
// 运行：pnpm exec vitest run test/reactivity/watch-effect.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, ref, watchEffect, nextTick, createApp } from '@actview/core'

/** 创建带 id 的宿主元素并挂载组件——拆分自 verify.test.tsx L15-21 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

// ------------------------------------------------------------
// 以下 it 块拷贝自 verify.test.tsx — 场景 24：onUnmounted / watchEffect（L1584-1630，2 用例）
// ------------------------------------------------------------
describe('场景 24：onUnmounted / watchEffect', () => {
  it('watchEffect：立即执行 + 依赖变化异步触发 + stop 停止', async () => {
    const state = reactive({ count: 1 })
    const calls: number[] = []
    const stop = watchEffect(() => calls.push(state.count))

    expect(calls).toEqual([1]) // 立即执行一次

    state.count = 2
    await nextTick()
    expect(calls).toEqual([1, 2]) // 依赖变化异步触发

    stop()
    state.count = 3
    await nextTick()
    expect(calls).toEqual([1, 2]) // stop 后不再响应
  })

  it('watchEffect：组件内创建 =》 随组件卸载自动停止', async () => {
    const state = reactive({ n: 0 })
    const hits: number[] = []
    const state2 = reactive({ show: true })
    function Child() {
      watchEffect(() => hits.push(state.n))
      return <span>child</span>
    }
    function App() {
      return <div>{state2.show ? <Child /> : null}</div>
    }
    mount('#s24c', App)
    expect(hits).toEqual([0])

    state.n = 1
    await nextTick()
    expect(hits).toEqual([0, 1])

    // 卸载 Child =》 watchEffect 自动停止
    state2.show = false
    await nextTick()
    state.n = 2
    await nextTick()
    expect(hits).toEqual([0, 1]) // 不再增加
  })
})