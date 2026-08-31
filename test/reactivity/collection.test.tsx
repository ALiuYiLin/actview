// ============================================================
// 集合响应式代理测试（拆分自 p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/collection.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive } from '@actview/core'
import { runEffect } from '@actview/core'

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: 集合响应式代理（L53-161, 10 用例）
// ------------------------------------------------------------
describe('P0: 集合响应式代理', () => {
  it('Map get/set 响应', () => {
    const map = reactive(new Map())
    let dummy: any
    runEffect(() => (dummy = map.get('a')))
    expect(dummy).toBe(undefined)
    map.set('a', 1)
    expect(dummy).toBe(1)
  })

  it('Map set 已有 key 更新触发依赖', () => {
    const map = reactive(new Map<string, number>([['a', 1]]))
    let dummy: any
    runEffect(() => (dummy = map.get('a')))
    expect(dummy).toBe(1)
    map.set('a', 2)
    expect(dummy).toBe(2)
  })

  it('Map delete 响应', () => {
    const map = reactive(new Map<string, number>([['a', 1]]))
    let dummy: any
    runEffect(() => (dummy = map.get('a')))
    map.delete('a')
    expect(dummy).toBe(undefined)
  })

  it('Map size 响应', () => {
    const map = reactive(new Map<string, number>())
    let dummy: any
    runEffect(() => (dummy = map.size))
    expect(dummy).toBe(0)
    map.set('a', 1)
    expect(dummy).toBe(1)
  })

  it('Map forEach 响应', () => {
    const map = reactive(new Map<string, number>([['a', 1]]))
    let dummy: any
    runEffect(() => {
      dummy = 0
      map.forEach((v) => (dummy += v))
    })
    expect(dummy).toBe(1)
    map.set('b', 2)
    expect(dummy).toBe(3)
  })

  it('Map 值深层响应（get 返回 reactive 包装）', () => {
    const map = reactive(new Map<string, { count: number }>())
    map.set('k', { count: 0 })
    const obj = map.get('k')!
    let dummy: any
    runEffect(() => (dummy = obj.count))
    obj.count = 1
    expect(dummy).toBe(1)
  })

  it('Map 迭代（for...of）响应', () => {
    const map = reactive(new Map<string, number>([['a', 1]]))
    let dummy: any
    runEffect(() => {
      dummy = 0
      for (const [, v] of map) dummy += v
    })
    expect(dummy).toBe(1)
    map.set('b', 2)
    expect(dummy).toBe(3)
  })

  it('Set add/delete/size 响应', () => {
    const set = reactive(new Set<number>())
    let dummy: any
    runEffect(() => (dummy = set.size))
    expect(dummy).toBe(0)
    set.add(1)
    expect(dummy).toBe(1)
    set.add(1) // 已存在：不重复触发
    expect(dummy).toBe(1)
    set.delete(1)
    expect(dummy).toBe(0)
  })

  it('Set has 响应', () => {
    const set = reactive(new Set<number>([1]))
    let dummy: any
    runEffect(() => (dummy = set.has(1)))
    expect(dummy).toBe(true)
    set.delete(1)
    expect(dummy).toBe(false)
  })

  it('WeakMap / WeakSet 基本操作不崩溃', () => {
    const wm = reactive(new WeakMap<object, number>())
    const k = {}
    wm.set(k, 1)
    expect(wm.get(k)).toBe(1)
    expect(wm.has(k)).toBe(true)
    wm.delete(k)
    expect(wm.has(k)).toBe(false)

    const ws = reactive(new WeakSet<object>())
    const o = {}
    ws.add(o)
    expect(ws.has(o)).toBe(true)
    ws.delete(o)
    expect(ws.has(o)).toBe(false)
  })
})