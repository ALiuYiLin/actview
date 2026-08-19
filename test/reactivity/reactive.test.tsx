// ============================================================
// reactive 对象 + 数组响应测试（拆分自 actview.test.tsx + verify.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/reactive.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, readonly, shallowReactive, markRaw, ref, nextTick, createApp } from 'actview'
import { runEffect } from '@actview/core'

/** 创建带 id 的宿主元素并挂载组件——拆分自 verify.test.tsx L15-21 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

// ------------------------------------------------------------
// 以下 it 块拷贝自 actview.test.tsx — 迁移：reactive 对象（L192-275，10 用例）
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
// 以下 it 块拷贝自 actview.test.tsx — 迁移：数组响应（L280-354，8 用例）
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
// 以下 describe 拷贝自 verify.test.tsx — 场景 6：数组方法（L252-282，1 用例）
// ------------------------------------------------------------
describe('场景 6：数组方法', () => {
  it('push/pop/splice/reverse/索引赋值触发更新', async () => {
    const state = reactive({ items: ['a', 'b', 'c'] })
    function ArrApp() {
      return <ul>{state.items.map((item) => <li key={item}>{item}</li>)}</ul>
    }
    const host = mount('#s6', ArrApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)

    state.items.push('d')
    await nextTick()
    expect(texts()).toEqual(['a', 'b', 'c', 'd'])

    state.items.pop()
    await nextTick()
    expect(texts()).toEqual(['a', 'b', 'c'])

    state.items.splice(1, 1)
    await nextTick()
    expect(texts()).toEqual(['a', 'c'])

    state.items.reverse()
    await nextTick()
    expect(texts()).toEqual(['c', 'a'])

    state.items[0] = 'x'
    await nextTick()
    expect(texts()).toEqual(['x', 'a'])
  })
})

// ------------------------------------------------------------
// 以下 describe 拷贝自 verify.test.tsx — 场景 7：for...in / in 响应（L287-323，1 用例）
// ------------------------------------------------------------
describe('场景 7：for...in / in 响应', () => {
  it('增删 key 触发遍历与 in 检查更新', async () => {
    const keysState = reactive({ a: 1, b: 2 })
    function collectKeys(obj: object) {
      const keys: string[] = []
      for (const k in obj) keys.push(k)
      return keys.join(',')
    }
    function KeysApp() {
      return (
        <div class="keys-app">
          <span class="keys">{collectKeys(keysState)}</span>
          <span class="has-b">{('b' in keysState) ? 'has-b' : 'no-b'}</span>
        </div>
      )
    }
    const host = mount('#s7', KeysApp)
    const getText = (cls: string) =>
      Array.from(host.children[0].children).find((c) => (c as HTMLElement).className === cls)!.textContent

    expect(getText('keys')).toBe('a,b')
    expect(getText('has-b')).toBe('has-b')

    ;(keysState as any).c = 3
    await nextTick()
    expect(getText('keys')).toBe('a,b,c')

    delete (keysState as any).b
    await nextTick()
    expect(getText('keys')).toBe('a,c')
    expect(getText('has-b')).toBe('no-b')
  })
})

// ------------------------------------------------------------
// 以下 describe 拷贝自 verify.test.tsx — 场景 8：markRaw / readonly / shallowReactive（L324-373，1 用例）
// ------------------------------------------------------------
describe('场景 8：markRaw / readonly / shallowReactive', () => {
  it('Date 不崩溃、markRaw 隔离、readonly 拦截、shallow 浅层', async () => {
    const rawMarkedObj = { n: 1 }
    const marked = markRaw(rawMarkedObj)
    const apiState = reactive({ d: new Date(0), normal: { n: 1 }, marked })
    const ro = readonly({ count: 1, nested: { deep: 1 } })
    const sh = shallowReactive({ top: 1, nested: { deep: 1 } })

    function ApiApp() {
      return (
        <div class="api-app">
          <span class="date">{apiState.d.getTime()}</span>
          <span class="normal">{apiState.normal.n}</span>
          <span class="marked">{apiState.marked.n}</span>
          <span class="ro">{ro.count}</span>
          <span class="ro-nested">{ro.nested.deep}</span>
          <span class="sh-top">{sh.top}</span>
          <span class="sh-nested">{sh.nested.deep}</span>
        </div>
      )
    }
    const host = mount('#s8', ApiApp)
    const getText = (cls: string) =>
      Array.from(host.children[0].children).find((c) => (c as HTMLElement).className === cls)!.textContent

    expect(getText('date')).toBe('0') // Date 不代理、方法可调用
    expect(getText('normal')).toBe('1')
    expect(getText('marked')).toBe('1')

    apiState.normal.n = 2
    await nextTick()
    expect(getText('normal')).toBe('2') // 普通嵌套响应

    rawMarkedObj.n = 2
    expect(getText('marked')).toBe('1') // markRaw 不响应

    sh.nested.deep = 2
    expect(getText('sh-nested')).toBe('1') // shallow 深层不响应

    sh.top = 2
    await nextTick()
    expect(getText('sh-top')).toBe('2') // shallow 浅层响应

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(ro as any).count = 99
    expect(getText('ro')).toBe('1') // readonly 拦截
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})