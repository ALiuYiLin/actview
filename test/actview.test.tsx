// ============================================================
// actview — 从 Vue 3 迁移的回归测试（检验框架 bug）
//   来源：E:\code3\vue3\packages\reactivity\__tests__\
//   （effect / reactive / reactiveArray / computed / watch 核心用例）
// 适配规则：
//   - effect(fn) → runEffect(fn)（首次同步执行，返回含 stop 的 effect）
//   - stop(e) → e.stop()；watch 默认异步 flush → await nextTick()
//   - 去掉依赖未实现 API（Map/Set 代理、isReactive、toRaw、computed setter 等）的用例
// 目的：用 Vue 3 多年积累的边界用例检验当前框架行为
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, ref, computed, watch, nextTick, markRaw } from 'actview'
import { runEffect } from '@actview/core'

// ------------------------------------------------------------
// 一、effect（迁移自 effect.spec.ts）
// ------------------------------------------------------------
describe('迁移：effect 基础', () => {
  it('should run the passed function once', () => {
    let count = 0
    runEffect(() => count++)
    expect(count).toBe(1)
  })

  it('should observe basic properties', () => {
    let dummy: any
    const counter = reactive({ num: 0 })
    runEffect(() => (dummy = counter.num))
    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
  })

  it('should observe multiple properties', () => {
    let dummy: any
    const counter = reactive({ num1: 0, num2: 0 })
    runEffect(() => (dummy = counter.num1 + counter.num1 + counter.num2))
    expect(dummy).toBe(0)
    counter.num1 = counter.num2 = 7
    expect(dummy).toBe(21)
  })

  it('should handle multiple effects', () => {
    let dummy1: any, dummy2: any
    const counter = reactive({ num: 0 })
    runEffect(() => (dummy1 = counter.num))
    runEffect(() => (dummy2 = counter.num))
    expect(dummy1).toBe(0)
    expect(dummy2).toBe(0)
    counter.num++
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
  })

  it('should observe nested properties', () => {
    let dummy: any
    const counter = reactive({ nested: { num: 0 } })
    runEffect(() => (dummy = counter.nested.num))
    expect(dummy).toBe(0)
    counter.nested.num = 8
    expect(dummy).toBe(8)
  })

  it('should observe delete operations', () => {
    let dummy: any
    const obj = reactive<{ prop?: string }>({ prop: 'value' })
    runEffect(() => (dummy = obj.prop))
    expect(dummy).toBe('value')
    delete obj.prop
    expect(dummy).toBe(undefined)
  })

  it('should observe has operations', () => {
    let dummy: any
    const obj = reactive<{ prop?: string | number }>({ prop: 'value' })
    runEffect(() => (dummy = 'prop' in obj))
    expect(dummy).toBe(true)
    delete obj.prop
    expect(dummy).toBe(false)
    obj.prop = 12
    expect(dummy).toBe(true)
  })

  it('should observe properties on the prototype chain', () => {
    let dummy: any
    const counter = reactive<{ num?: number }>({ num: 0 })
    const parentCounter = reactive({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    runEffect(() => (dummy = counter.num))
    expect(dummy).toBe(0)
    delete counter.num
    expect(dummy).toBe(2)
    parentCounter.num = 4
    expect(dummy).toBe(4)
    counter.num = 3
    expect(dummy).toBe(3)
  })

  it('should observe has operations on the prototype chain', () => {
    let dummy: any
    const counter = reactive<{ num?: number }>({ num: 0 })
    const parentCounter = reactive<{ num?: number }>({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    runEffect(() => (dummy = 'num' in counter))
    expect(dummy).toBe(true)
    delete counter.num
    expect(dummy).toBe(true)
    parentCounter.num = 4
    expect(dummy).toBe(true)
  })

  it('should not trigger if value did not change', () => {
    let dummy: any
    let runs = 0
    const obj = reactive<{ a?: number; b?: number }>({ a: 1, b: 2 })
    const effect = runEffect(() => {
      runs++
      dummy = obj.a
    })
    expect(dummy).toBe(1)
    obj.b = 3
    expect(runs).toBe(1)
    expect(dummy).toBe(1)
    effect.stop()
  })

  it('should discover new branches while running', () => {
    let dummy: any
    let run = 0
    const obj = reactive<{ prop?: string; run?: boolean }>({ prop: 'value', run: false })
    const conditional = () => (obj.run ? obj.prop : 'other')
    runEffect(() => {
      dummy = conditional()
      run++
    })
    expect(dummy).toBe('other')
    obj.prop = 'value2'
    expect(run).toBe(1) // prop 未读（run=false 分支），不触发
    expect(dummy).toBe('other')
    obj.run = true
    expect(run).toBe(2)
    expect(dummy).toBe('value2')
    obj.prop = 'value3'
    expect(run).toBe(3)
    expect(dummy).toBe('value3')
  })

  it('should not be triggered by child effects', () => {
    let dummy: any
    const obj = reactive({ a: 1, b: 2 })
    const parentEffect = runEffect(() => {
      dummy = obj.a
      runEffect(() => {
        obj.b // 子 effect 读 b
      })
    })
    obj.b = 3 // 只触发子 effect，不触发父
    expect(dummy).toBe(1)
    parentEffect.stop()
  })

  it('should stop the effect', () => {
    let dummy: any
    const obj = reactive({ prop: 1 })
    const effect = runEffect(() => (dummy = obj.prop))
    expect(dummy).toBe(1)
    effect.stop()
    obj.prop = 2
    expect(dummy).toBe(1)
  })

  it('should cleanup dependencies on re-run (stale dep not triggered)', () => {
    let dummy: any
    const obj = reactive<{ ok?: boolean; count?: number }>({ ok: true, count: 0 })
    const effect = runEffect(() => {
      dummy = obj.ok ? obj.count : 0
    })
    expect(dummy).toBe(0)
    obj.ok = false // 切换分支：count 依赖被清理
    obj.count = 5
    expect(dummy).toBe(0) // count 不再触发
    obj.ok = true
    expect(dummy).toBe(5)
    effect.stop()
  })
})

// ------------------------------------------------------------
// 二、reactive（迁移自 reactive.spec.ts 纯对象核心）
// ------------------------------------------------------------
describe('迁移：reactive 对象', () => {
  it('nested reactives', () => {
    const original = { nested: { foo: 1 }, array: [{ bar: 2 }] }
    const observed = reactive(original)
    expect(observed.nested).not.toBe(original.nested)
    expect(observed.array).not.toBe(original.array)
    expect(observed.array[0]).not.toBe(original.array[0])
  })

  it('failed set operation should not trigger effects', () => {
    const original: any = {}
    Object.defineProperty(original, 'foo', {
      value: 1,
      writable: false,
      configurable: true,
    })
    const observed = reactive(original)
    let dummy: any
    let run = 0
    runEffect(() => {
      run++
      dummy = observed.foo
    })
    expect(() => {
      observed.foo = 2 // 不可写属性：Proxy set 应抛出 TypeError 且不触发
    }).toThrow(TypeError)
    expect(dummy).toBe(1)
    expect(run).toBe(1)
  })

  it('original value change should reflect in observed value', () => {
    const original: any = { foo: 1 }
    const observed = reactive(original)
    original.bar = 1
    expect(observed.bar).toBe(1)
    delete original.foo
    expect('foo' in observed).toBe(false)
  })

  it('setting a property with an unobserved value should wrap with reactive', () => {
    const observed = reactive<{ foo?: object }>({})
    const raw = {}
    observed.foo = raw
    expect(observed.foo).not.toBe(raw)
  })

  it('observing already observed value should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(reactive(observed)).toBe(observed)
  })

  it('observing the same value multiple times should return same Proxy', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(reactive(original)).toBe(observed)
  })

  it('markRaw should skip proxy', () => {
    const original = { foo: 1 }
    markRaw(original)
    const observed = reactive(original)
    expect(observed).toBe(original) // 不代理
  })

  it('should not observe non-extensible objects (Vue 3 语义)', () => {
    const obj = reactive({})
    Object.preventExtensions(obj)
    const observed = reactive(obj)
    expect(observed).toBe(obj) // 非可扩展对象不代理
  })

  it('should not observe objects with __v_skip', () => {
    const obj = reactive({ __v_skip: true, foo: 1 })
    const observed = reactive(obj)
    expect(observed).toBe(obj)
  })

  it('should keep ref unwrapped when read via proxy (Vue 3: 不自动解包 ref)', () => {
    const r = ref(1)
    const observed = reactive<{ n?: unknown }>({ n: r })
    expect(observed.n).toBe(r) // 我们不自动解包（与 Vue 3 的嵌套 ref 解包不同，见语义差异）
  })
})

// ------------------------------------------------------------
// 三、数组（迁移自 reactiveArray.spec.ts 核心）
// ------------------------------------------------------------
describe('迁移：数组响应', () => {
  it('should make Array reactive', () => {
    let dummy: any
    const arr = reactive<number[]>([])
    runEffect(() => (dummy = arr.length))
    expect(dummy).toBe(0)
    arr.push(1)
    expect(dummy).toBe(1)
  })

  it('observed value should proxy mutations to original (Array)', () => {
    const original: any[] = []
    const observed = reactive(original)
    observed.push(1)
    expect(observed[0]).toBe(1)
    expect(original[0]).toBe(1)
  })

  it('delete on Array should not trigger length dependency', () => {
    let lengthDummy: any
    const arr = reactive([1, 2, 3])
    runEffect(() => (lengthDummy = arr.length))
    expect(lengthDummy).toBe(3)
    delete arr[1]
    expect(lengthDummy).toBe(3) // delete 不改变 length
  })

  it('add existing index on Array should not trigger length dependency', () => {
    let lengthDummy: any
    const arr = reactive([1, 2, 3])
    runEffect(() => (lengthDummy = arr.length))
    expect(lengthDummy).toBe(3)
    arr[1] = 5 // 索引已存在：length 不变
    expect(lengthDummy).toBe(3)
  })

  it('add non-integer prop on Array should not trigger length dependency', () => {
    let lengthDummy: any
    const arr = reactive<any[]>([])
    runEffect(() => (lengthDummy = arr.length))
    expect(lengthDummy).toBe(0)
    ;(arr as any)['foo'] = 1
    expect(lengthDummy).toBe(0)
  })

  it('shift on Array should trigger dependency once', () => {
    let dummy: any
    const arr = reactive([1, 2, 3])
    runEffect(() => (dummy = arr[0]))
    expect(dummy).toBe(1)
    arr.shift()
    expect(dummy).toBe(2)
  })

  it('track length on for...in iteration', () => {
    let dummy: any
    const arr = reactive(['a'])
    runEffect(() => {
      dummy = 0
      for (const key in arr) dummy++
    })
    expect(dummy).toBe(1)
    arr.push('b')
    expect(dummy).toBe(2)
  })

  it('iterator (for...of / spread) should be reactive', () => {
    let dummy: any
    const arr = reactive([1, 2])
    runEffect(() => (dummy = arr.join(',')))
    expect(dummy).toBe('1,2')
    arr.push(3)
    expect(dummy).toBe('1,2,3')
  })
})

// ------------------------------------------------------------
// 四、computed（迁移自 computed.spec.ts 核心）
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

  it('should trigger effect', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    let dummy: any
    runEffect(() => (dummy = cValue.value))
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
  })

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

  it('should trigger effect when chained', () => {
    const value = reactive({ foo: 0 })
    const getter1 = vi.fn(() => value.foo)
    const getter2 = vi.fn(() => c1.value + 1)
    const c1 = computed(getter1)
    const c2 = computed(getter2)
    let dummy: any
    runEffect(() => (dummy = c2.value))
    expect(dummy).toBe(1)
    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(2)
    // 链式：foo 变化 → c1 置脏 → c2 重算
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should not be readonly (可写？我们不支持 setter——computed 是只读 getter)', () => {
    const value = reactive({ foo: 0 })
    const c = computed(() => value.foo)
    expect(c.value).toBe(0)
  })
})

// ------------------------------------------------------------
// 五、watch（迁移自 watch.spec.ts 核心，适配异步 flush）
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
