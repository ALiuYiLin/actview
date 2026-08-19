// ============================================================
// 数组 identity 方法测试（拆分自 p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/array-identity.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive } from 'actview'

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: 数组 identity 方法（toRaw 比较）（L335-350，2 用例）
// ------------------------------------------------------------
describe('P0: 数组 identity 方法（toRaw 比较）', () => {
  it('indexOf / includes / lastIndexOf 匹配 reactive 元素', () => {
    const obj = { id: 1 }
    const arr = reactive([obj])
    expect(arr.indexOf(obj)).toBe(0)
    expect(arr.includes(obj)).toBe(true)
    expect(arr.lastIndexOf(obj)).toBe(0)
  })

  it('未命中时用原始值再比较', () => {
    const arr = reactive([{ id: 1 }])
    const query = { id: 1 } // 不同引用，应 -1
    expect(arr.indexOf(query)).toBe(-1)
    expect(arr.includes(query)).toBe(false)
  })
})