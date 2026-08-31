// ============================================================
// computed 测试（拆分自 actview.test.tsx + verify.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/computed.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, computed } from 'actview'
import { runEffect } from 'actview'

// ------------------------------------------------------------
// 以下 it 块拷贝自 actview.test.tsx — 迁移：computed（L359-427，6 用例）
// ------------------------------------------------------------
describe('迁移：computed', () => {
  it('should return updated value', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    expect(cValue.value).toBe(undefined)
    value.foo = 1
    expect(cValue.value).toBe(1)
  })

  it('should compute lazily', () => {
    const value = reactive<{ foo?: number }>({})
    const getter = vi.fn(() => value.foo)
    const cValue = computed(getter)
    expect(getter).not.toHaveBeenCalled() // 惰性：读取前不求值
    expect(cValue.value).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1)
    expect(cValue.value).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1) // 缓存：再次读取不重算
  })

  // v1 的 runEffect（effect 创建）是特有 API——「should trigger effect」
  // 与「should trigger effect when chained」用例移除（v2 用 watchEffect，
  // 见 test/v2 与 watch 相关用例）

  it('should work when chained', () => {
    const value = reactive({ foo: 0 })
    const c1 = computed(() => value.foo)
    const c2 = computed(() => c1.value + 1)
    expect(c2.value).toBe(1)
    expect(c1.value).toBe(0)
    value.foo++
    expect(c2.value).toBe(2)
    expect(c1.value).toBe(1)
  })

  it('should not be readonly (可写？我们不支持 setter——computed 是只读 getter)', () => {
    const value = reactive({ foo: 0 })
    const c = computed(() => value.foo)
    expect(c.value).toBe(0)
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 verify.test.tsx — 场景 22：computed 可写 + computed 只读（L1287-1314，2 用例）
// ------------------------------------------------------------
describe('场景 22：toRef / toRefs（computed 相关）', () => {
  it('computed 可写：{ get, set } 形态赋值触发 setter 并重算', () => {
    const state = reactive({ firstName: '张', lastName: '三' })
    const fullName = computed({
      get: () => state.firstName + state.lastName,
      set: (v: string) => {
        // 简化的拆分赋值：前 1 字为姓，其余为名
        state.firstName = v.slice(0, 1)
        state.lastName = v.slice(1)
      },
    })

    expect(fullName.value).toBe('张三')
    fullName.value = '李四' // 触发 setter
    expect(state.firstName).toBe('李')
    expect(state.lastName).toBe('四')
    expect(fullName.value).toBe('李四') // 重算一致
  })

  it('computed 只读：无 setter 时赋值 warn 且值不变', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const state = reactive({ n: 1 })
    const double = computed(() => state.n * 2)
    ;(double as any).value = 100 // 只读 computed 赋值
    expect(warn).toHaveBeenCalled()
    expect(double.value).toBe(2) // 值未被修改
    warn.mockRestore()
  })
})