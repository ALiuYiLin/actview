// ============================================================
// ref / toRef / toRefs / shallowRef / triggerRef / toValue 测试
// （拆分自 verify.test.tsx + p0.test.tsx）
// v1 特有 API 用例移除：runEffect（v1 effect 创建）驱动的 toRef/toRefs
// 用例、unrefs（v1 批量解包）、「toRef 对已是 ref 的属性原样返回」
// （vue 3.5 的 toRef 对象形态总是返回 ObjectRefImpl，行为等价但不
// 原样返回）——v2 中 toRef/toRefs 由 vue 提供，见 test/v2
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, ref, shallowRef, triggerRef, shallowReadonly, computed, isRef, isReactive, toRef, toRefs, toValue } from 'actview'

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: shallowRef / triggerRef / shallowReadonly（L220-247）
// ------------------------------------------------------------
describe('P0: shallowRef / triggerRef / shallowReadonly', () => {
  it('shallowRef 对象值不深层包装', () => {
    const raw = { n: 0 }
    const s = shallowRef(raw)
    expect(isReactive(s.value)).toBe(false)
    expect(s.value).toBe(raw)
  })

  // 「shallowRef 内部属性变化不触发，triggerRef 手动触发」用例使用
  // v1 的 runEffect——移除（vue 语义：triggerRef 手动触发依赖重跑）

  it('shallowReadonly 仅第一层只读', () => {
    const obj = shallowReadonly({ a: 1, nested: { b: 2 } })
    expect(obj.a).toBe(1)
    // vue 的 shallowReadonly<T> 类型层第一层即 readonly（{ readonly [P]: T[P] }）——
    // 赋值编译期拦截（TS2540），运行时静默失败
    // @ts-expect-error 第一层只读：赋值被拦截
    obj.a = 2
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