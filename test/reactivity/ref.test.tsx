// ============================================================
// ref / toRef / toRefs / shallowRef / triggerRef / toValue 测试
// （拆分自 verify.test.tsx + p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/ref.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, ref, shallowRef, triggerRef, shallowReadonly, computed, isRef, isReactive, toRef, toRefs, toValue, unrefs } from 'actview'
import { runEffect } from '@actview/core'

// ------------------------------------------------------------
// 以下 it 块拷贝自 verify.test.tsx — 场景 22：toRef / toRefs（L1258-1340）
// 仅包含 4 个 ref 相关的 it：toRef、toRefs、toRef 对已是 ref 的属性、unrefs
// ------------------------------------------------------------
describe('场景 22：toRef / toRefs（ref 部分）', () => {
  it('toRef 属性读写响应式', () => {
    const state = reactive({ count: 0 })
    const countRef = toRef(state, 'count')
    expect(countRef.value).toBe(0)
    expect(isRef(countRef)).toBe(true)

    let dummy: any
    const e = runEffect(() => (dummy = countRef.value))
    state.count = 5 // 源对象变化 → ref 读取触发
    expect(dummy).toBe(5)
    countRef.value = 10 // ref 写入 → 写回源对象并触发
    expect(state.count).toBe(10)
    expect(dummy).toBe(10)
    e.stop()
  })

  it('toRefs 解构保持响应式', () => {
    const state = reactive({ a: 1, b: 2 })
    const { a, b } = toRefs(state)
    let dummy: any
    const e = runEffect(() => (dummy = a.value + b.value))
    expect(dummy).toBe(3)
    state.a = 10
    expect(dummy).toBe(12)
    b.value = 5
    expect(dummy).toBe(15)
    expect(state.b).toBe(5)
    e.stop()
  })

  it('toRef 对已是 ref 的属性原样返回', () => {
    const r = ref(1)
    const state = reactive<{ n: typeof r }>({ n: r })
    expect(toRef(state, 'n')).toBe(r)
  })

  it('unrefs 批量解包：ref 取 .value，非 ref 原样返回（仅一层）', () => {
    const state = reactive({ disabled: true, id: 'b1' })
    const { disabled, id } = toRefs(state)
    const plain = unrefs({ disabled, id, fixed: 'x' })
    expect(plain).toEqual({ disabled: true, id: 'b1', fixed: 'x' })
    expect(isRef(plain.disabled)).toBe(false) // 已解包为值

    // 解包结果随源变化（在响应式上下文读取时追踪）
    let dummy: any
    const e = runEffect(() => (dummy = unrefs({ disabled }).disabled))
    expect(dummy).toBe(true)
    state.disabled = false
    expect(dummy).toBe(false)
    e.stop()
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: shallowRef / triggerRef / shallowReadonly（L220-247，3 用例）
// ------------------------------------------------------------
describe('P0: shallowRef / triggerRef / shallowReadonly', () => {
  it('shallowRef 对象值不深层包装', () => {
    const raw = { n: 0 }
    const s = shallowRef(raw)
    expect(isReactive(s.value)).toBe(false)
    expect(s.value).toBe(raw)
  })

  it('shallowRef 内部属性变化不触发，triggerRef 手动触发', () => {
    const s = shallowRef({ n: 0 })
    let dummy: any
    runEffect(() => (dummy = s.value.n))
    expect(dummy).toBe(0)
    s.value.n = 1 // 浅层：不自动触发
    expect(dummy).toBe(0)
    triggerRef(s)
    expect(dummy).toBe(1)
  })

  it('shallowReadonly 仅第一层只读', () => {
    const obj = shallowReadonly({ a: 1, nested: { b: 2 } })
    expect(obj.a).toBe(1)
    // @ts-expect-error 第一层只读：赋值被拦截（运行时静默失败）
    obj.a = 2 // 第一层只读：赋值被拦截
    expect(obj.a).toBe(1)
    obj.nested.b = 3 // 嵌套可写（浅只读）
    expect(obj.nested.b).toBe(3)
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: toValue（L380-394，2 用例）
// ------------------------------------------------------------
describe('P0: toValue', () => {
  it('统一取值：普通值 / ref / getter', () => {
    expect(toValue(1)).toBe(1)
    expect(toValue(ref(1))).toBe(1)
    expect(toValue(() => 2)).toBe(2)
  })

  it('getter 在 computed 内建立响应式追踪', () => {
    const state = reactive({ n: 1 })
    const c = computed(() => toValue(() => state.n))
    expect(c.value).toBe(1)
    state.n = 2
    expect(c.value).toBe(2)
  })
})