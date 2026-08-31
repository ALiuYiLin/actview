// ============================================================
// reactive 对象 + 数组响应测试（拆分自 actview.test.tsx + verify.test.tsx）
// v1 特有 API 用例移除：runEffect（v1 effect 创建）驱动的用例（failed set、
// 数组响应细节）——v2 的响应式由 vue 提供（vue 的数组响应语义见 vue 官方测试）
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { reactive, readonly, shallowReactive, markRaw, ref, nextTick, createApp } from 'actview'

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

  // v1 的「failed set operation should not trigger effects」用例使用
  // runEffect（v1 API）——移除

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

  it('reactive 读 ref 属性自动解包（vue 语义）', () => {
    const r = ref(1)
    const observed = reactive<{ n?: unknown }>({ n: r })
    // vue 3.5：reactive 读取 ref 属性自动解包为值
    expect(observed.n).toBe(1)
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 actview.test.tsx — 迁移：数组响应（L280-354，8 用例）
// v1 的 runEffect 驱动的数组响应细节用例移除（vue 的数组响应语义由 vue
// 提供；组件级数组方法验证见下方「场景 6：数组方法」）
// ------------------------------------------------------------

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