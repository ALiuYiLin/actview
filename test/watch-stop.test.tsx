// ============================================================
// watch stop 后 stale 微任务守卫（回归测试）
//   runJob 缺少 if (!effect.active) 守卫 → stop 后已排队的
//   微任务仍执行：effect.run() 短路返回 undefined 被当 newValue
//   传给回调（deep/forceTrigger 场景无条件触发）。
// 运行：pnpm vitest run test/watch-stop.test.tsx
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
