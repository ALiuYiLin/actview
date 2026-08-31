// ============================================================
// watch immediate 首次值 === undefined 的触发语义
// 背景：Vue 3 用 INITIAL_WATCHER_VALUE 哨兵作为初始 oldValue，保证
//   immediate 首次回调总是执行（即使首次求值结果恰好是 undefined）。
//   actview watch 直接以 undefined 作为初始 oldValue → 首次求值若为
//   undefined，hasChanged(undefined, undefined) === false → 回调被跳过。
// 运行：pnpm exec vitest run test/reactivity/watch-immediate-undefined.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { ref, watch } from 'actview'

describe('watch immediate 首次值为 undefined（Vue 3 哨兵语义）', () => {
  it('A：ref 首次值为 undefined → immediate 首次回调应执行一次', () => {
    const r = ref<number | undefined>(undefined)
    const calls: Array<[any, any]> = []
    watch(r, (n, o) => calls.push([n, o]), { immediate: true })
    // Vue 3 语义：immediate 首次无条件触发，oldVal 显示为 undefined
    expect(calls).toEqual([[undefined, undefined]])
  })

  it('B：getter 首次值为 undefined → immediate 首次回调应执行一次', () => {
    const calls: Array<[any, any]> = []
    watch(() => undefined, (n, o) => calls.push([n, o]), { immediate: true })
    expect(calls).toEqual([[undefined, undefined]])
  })

  it('C：数组源含 undefined → immediate 首次回调应执行一次', () => {
    const a = ref(undefined)
    const b = ref(1)
    const calls: Array<[any, any]> = []
    watch([a, b], (n, o) => calls.push([n, o]), { immediate: true })
    // vue 语义：数组源首次 oldValue 为空数组 []
    expect(calls).toEqual([[[undefined, 1], []]])
  })

  it('D（对照）：首次值为 null → 应触发（null !== undefined）', () => {
    const r = ref<string | null>(null)
    const calls: number[] = []
    watch(r, () => calls.push(1), { immediate: true })
    expect(calls).toEqual([1])
  })

  it('E（对照）：首次值为普通值 → 应触发', () => {
    const r = ref(0)
    const calls: Array<[any, any]> = []
    watch(r, (n, o) => calls.push([n, o]), { immediate: true })
    expect(calls).toEqual([[0, undefined]])
  })

  it('F：首次 undefined 不触发后，变化为其他值仍正常触发', async () => {
    const r = ref<string | undefined>(undefined)
    const calls: Array<[any, any]> = []
    watch(r, (n, o) => calls.push([n, o]), { immediate: true })
    r.value = 'x'
    await Promise.resolve()
    expect(calls).toEqual([[undefined, undefined], ['x', undefined]])
  })
})
