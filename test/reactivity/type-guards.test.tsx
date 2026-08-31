// ============================================================
// 判型工具测试（拆分自 p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/type-guards.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, readonly, shallowReactive, shallowRef, markRaw, toRaw, isReactive, isReadonly, isProxy, isShallow } from 'actview'

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: toRaw / isReactive / isReadonly / isProxy / isShallow（L166-215，6 用例）
// ------------------------------------------------------------
describe('P0: toRaw / isReactive / isReadonly / isProxy / isShallow', () => {
  it('toRaw 取原始对象', () => {
    const raw = { a: 1 }
    const r = reactive(raw)
    expect(toRaw(r)).toBe(raw)
    expect(toRaw(raw)).toBe(raw)
  })

  it('reactive 幂等返回同一代理', () => {
    const raw = { a: 1 }
    const r1 = reactive(raw)
    const r2 = reactive(r1)
    expect(r2).toBe(r1)
  })

  it('isReactive / isReadonly / isProxy 判定', () => {
    const raw = { a: 1 }
    const r = reactive(raw)
    const ro = readonly(raw)
    expect(isReactive(r)).toBe(true)
    expect(isReactive(raw)).toBe(false)
    expect(isReadonly(ro)).toBe(true)
    expect(isReadonly(r)).toBe(false)
    expect(isProxy(r)).toBe(true)
    expect(isProxy(ro)).toBe(true)
    expect(isProxy(raw)).toBe(false)
  })

  it('readonly(reactive) 仍判定为 reactive', () => {
    const r = reactive({ a: 1 })
    const ro = readonly(r)
    expect(isReadonly(ro)).toBe(true)
    expect(isReactive(ro)).toBe(true)
  })

  it('markRaw 跳过代理', () => {
    const raw = markRaw({ a: 1 })
    expect(reactive(raw)).toBe(raw)
    expect(isReactive(reactive(raw))).toBe(false)
  })

  it('isShallow 判定', () => {
    const s = shallowReactive({ a: 1 })
    const r = reactive({ a: 1 })
    const sr = shallowRef(0)
    expect(isShallow(s)).toBe(true)
    expect(isShallow(r)).toBe(false)
    expect(isShallow(sr)).toBe(true)
  })
})