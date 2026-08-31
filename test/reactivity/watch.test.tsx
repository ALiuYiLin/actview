// ============================================================
// watch 测试（拆分自 actview.test.tsx + p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/watch.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, ref, computed, watch, watchEffect, onWatcherCleanup, nextTick } from 'actview'

/** 等所有微任务（含定时器）执行完，用于异步 watch — 拆分自 p0.test.tsx L38 */
const flush = () => new Promise((r) => setTimeout(r, 0))

// ------------------------------------------------------------
// 以下 it 块拷贝自 actview.test.tsx — 迁移：watch（L428-524，7 用例）
// ------------------------------------------------------------
describe('迁移：watch', () => {
  it('with callback', async () => {
    let dummy: any
    const source = ref(0)
    watch(source, () => {
      dummy = source.value
    })
    expect(dummy).toBe(undefined)
    source.value++
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('watch multiple sources', async () => {
    const log: [number, number][] = []
    const n1 = ref(0)
    const n2 = ref(0)
    watch([n1, n2], (newVals, oldVals) => {
      log.push([newVals[0], newVals[1]])
    })
    n1.value++
    await nextTick()
    expect(log[log.length - 1]).toEqual([1, 0])
    n2.value++
    await nextTick()
    expect(log[log.length - 1]).toEqual([1, 1])
  })

  it('watch reactive object source (deep by default)', async () => {
    const state = reactive({ a: 1, nested: { b: 2 } })
    const log: any[] = []
    watch(state, (v) => log.push(v.a))
    state.a = 2
    await nextTick()
    expect(log).toEqual([2])
    state.nested.b = 3 // 深遍历：嵌套属性变化也触发
    await nextTick()
    expect(log).toEqual([2, 2])
  })

  it('watch getter with immediate', async () => {
    const source = ref(0)
    const log: number[] = []
    watch(
      () => source.value,
      (v) => log.push(v),
      { immediate: true },
    )
    expect(log).toEqual([0])
    source.value = 1
    await nextTick()
    expect(log).toEqual([0, 1])
  })

  it('watch with cleanup (onCleanup 在下一次触发前执行)', async () => {
    const source = ref(0)
    const log: string[] = []
    // 非 immediate：首次不回调，因此首次回调是改到 1 时
    watch(source, (v, _o, onCleanup) => {
      onCleanup(() => log.push(`cleanup:${v}`))
      log.push(`run:${v}`)
    })
    source.value = 1
    await nextTick()
    source.value = 2
    await nextTick()
    expect(log).toEqual(['run:1', 'cleanup:1', 'run:2'])
  })

  it('should ensure correct execution order in batch processing', async () => {
    const dummy: number[] = []
    const n1 = ref(0)
    const n2 = ref(0)
    const sum = computed(() => n1.value + n2.value)
    watch(n1, () => {
      dummy.push(1)
      n2.value++
    })
    watch(sum, () => dummy.push(2))
    watch(n1, () => dummy.push(3))

    n1.value++
    await nextTick()
    expect(dummy).toEqual([1, 2, 3]) // 依赖链顺序：n1 → sum（n2 变化后）→ n1
  })

  it('watch with immediate reset', async () => {
    const value = ref(false)
    watch(value, () => {
      value.value = false // 回调内重置自身源
    })
    value.value = true
    value.value = true
    await nextTick()
    expect(value.value).toBe(false)
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: watch 选项（L252-330，7 用例）
// ------------------------------------------------------------
describe('P0: watch 选项', () => {
  it('flush: sync 同步执行', () => {
    const state = reactive({ n: 0 })
    let calls = 0
    watch(() => state.n, () => calls++, { flush: 'sync' })
    state.n = 1
    expect(calls).toBe(1)
  })

  it('flush: post 延迟到 nextTick 后', async () => {
    const state = reactive({ n: 0 })
    const order: string[] = []
    watch(() => state.n, () => order.push('watch'), { flush: 'post' })
    state.n = 1
    order.push('sync')
    expect(order).toEqual(['sync'])
    await nextTick()
    await flush()
    expect(order).toEqual(['sync', 'watch'])
  })

  it('deep: true 对 getter 源深度遍历', async () => {
    const state = reactive({ a: { b: 1 } })
    let calls = 0
    watch(() => state.a, () => calls++, { deep: true })
    await flush()
    state.a.b = 2
    await flush()
    expect(calls).toBe(1)
  })

  it('deep: false 关闭对象源默认深度', async () => {
    const state = reactive({ a: { b: 1 } })
    let calls = 0
    watch(state, () => calls++, { deep: false })
    await flush()
    state.a.b = 2 // 浅监听：内部变化不触发
    await flush()
    expect(calls).toBe(0)
  })

  it('once: true 回调只执行一次', async () => {
    const state = reactive({ n: 0 })
    let calls = 0
    watch(() => state.n, () => calls++, { once: true })
    state.n = 1
    await flush()
    state.n = 2
    await flush()
    expect(calls).toBe(1)
  })

  it('onWatcherCleanup 注册清理函数', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    watch(() => state.n, () => {
      onWatcherCleanup(() => log.push('cleanup'))
      log.push('run')
    })
    state.n = 1
    await flush()
    state.n = 2
    await flush()
    expect(log).toEqual(['run', 'cleanup', 'run'])
  })

  it('watchEffect 内 onWatcherCleanup', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    watchEffect(() => {
      onWatcherCleanup(() => log.push('cleanup'))
      log.push(`run:${state.n}`)
    })
    await flush()
    state.n = 1
    await flush()
    expect(log).toEqual(['run:0', 'cleanup', 'run:1'])
  })
})