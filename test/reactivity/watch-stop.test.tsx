// ============================================================
// watch stop 后 stale 微任务守卫（整文件移动自 test/watch-stop.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/watch-stop.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, watch, nextTick } from 'actview'

describe('watch stop 后 stale 微任务', () => {
  it('stop 后已排队的普通 watch 不触发回调（修复前会收到 undefined）', async () => {
    const cb = vi.fn()
    const state = reactive({ n: 0 })
    const stop = watch(() => state.n, cb)

    state.n = 1 // 排队 runJob（微任务）
    stop() // 微任务执行前 stop

    await nextTick()
    // 修复前：runJob 无 active 守卫 → effect.run() 返回 undefined →
    // hasChanged(undefined, 0) 成立 → cb(undefined, 0) 被调用 ✗
    expect(cb).not.toHaveBeenCalled()
  })

  it('stop 后已排队的 deep watch 不触发回调（forceTrigger 无条件触发）', async () => {
    const cb = vi.fn()
    const state = reactive({ obj: { a: 1 } })
    const stop = watch(() => state.obj, cb, { deep: true })

    state.obj = { a: 2 } // 排队
    stop()

    await nextTick()
    // deep → forceTrigger 恒真：无守卫时回调必触发（newValue=undefined）
    expect(cb).not.toHaveBeenCalled()
  })

  it('stop 后重新改 state 也不再触发（依赖已清除）', async () => {
    const cb = vi.fn()
    const state = reactive({ n: 0 })
    const stop = watch(() => state.n, cb)

    state.n = 1
    stop()
    await nextTick()
    expect(cb).not.toHaveBeenCalled()

    state.n = 2 // stop 后依赖已清除，不应再触发
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })
})