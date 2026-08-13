// ============================================================
// P0 能力补齐 — 验收测试（vitest + happy-dom）
//   覆盖：Map/Set/WeakMap/WeakSet 代理、判型工具、shallowRef/
//   shallowReadonly/triggerRef、watch flush/deep/once、onWatcherCleanup、
//   数组 identity 方法、effectScope/onScopeDispose、toValue/isShallow、
//   SVG 命名空间、dangerouslySetInnerHTML、passive 事件
// 运行：pnpm test
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  ref,
  shallowRef,
  triggerRef,
  watch,
  watchEffect,
  onWatcherCleanup,
  effectScope,
  onScopeDispose,
  toValue,
  computed,
  nextTick,
  createApp
} from 'actview'
import { runEffect } from '@actview/core'

/** 等所有微任务（含定时器）执行完，用于异步 watch */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** 创建带唯一 id 的宿主元素并挂载组件（避免 querySelector 命中旧 host） */
let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'p0-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// 1. Map / Set / WeakMap / WeakSet 响应式代理
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

// ------------------------------------------------------------
// 2. 判型工具
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

// ------------------------------------------------------------
// 3. shallowRef / triggerRef / shallowReadonly
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
    obj.a = 2 // 第一层只读：赋值被拦截
    expect(obj.a).toBe(1)
    obj.nested.b = 3 // 嵌套可写（浅只读）
    expect(obj.nested.b).toBe(3)
  })
})

// ------------------------------------------------------------
// 4. watch flush / deep / once / onWatcherCleanup
// ------------------------------------------------------------
describe('P0: watch 选项', () => {
  it('flush: sync 同步执行', () => {
    const state = reactive({ n: 0 })
    let calls = 0
    watch(() => state.n, () => calls++, { flush: 'sync' })
    state.n = 1
    expect(calls).toBe(1)
  })

  it('flush: post 延迟到 nextTick 后', async () => {
    const state = reactive({ n: 0 })
    const order: string[] = []
    watch(() => state.n, () => order.push('watch'), { flush: 'post' })
    state.n = 1
    order.push('sync')
    expect(order).toEqual(['sync'])
    await nextTick()
    await flush()
    expect(order).toEqual(['sync', 'watch'])
  })

  it('deep: true 对 getter 源深度遍历', async () => {
    const state = reactive({ a: { b: 1 } })
    let calls = 0
    watch(() => state.a, () => calls++, { deep: true })
    await flush()
    state.a.b = 2
    await flush()
    expect(calls).toBe(1)
  })

  it('deep: false 关闭对象源默认深度', async () => {
    const state = reactive({ a: { b: 1 } })
    let calls = 0
    watch(state, () => calls++, { deep: false })
    await flush()
    state.a.b = 2 // 浅监听：内部变化不触发
    await flush()
    expect(calls).toBe(0)
  })

  it('once: true 回调只执行一次', async () => {
    const state = reactive({ n: 0 })
    let calls = 0
    watch(() => state.n, () => calls++, { once: true })
    state.n = 1
    await flush()
    state.n = 2
    await flush()
    expect(calls).toBe(1)
  })

  it('onWatcherCleanup 注册清理函数', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    watch(() => state.n, () => {
      onWatcherCleanup(() => log.push('cleanup'))
      log.push('run')
    })
    state.n = 1
    await flush()
    state.n = 2
    await flush()
    expect(log).toEqual(['run', 'cleanup', 'run'])
  })

  it('watchEffect 内 onWatcherCleanup', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    watchEffect(() => {
      onWatcherCleanup(() => log.push('cleanup'))
      log.push(`run:${state.n}`)
    })
    await flush()
    state.n = 1
    await flush()
    expect(log).toEqual(['run:0', 'cleanup', 'run:1'])
  })
})

// ------------------------------------------------------------
// 5. 数组 identity 方法
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

// ------------------------------------------------------------
// 6. effectScope / onScopeDispose
// ------------------------------------------------------------
describe('P0: effectScope / onScopeDispose', () => {
  it('scope.stop 停止 effect 并执行 cleanup', () => {
    const scope = effectScope()
    const state = reactive({ n: 0 })
    let dummy = 0
    let cleaned = 0
    scope.run(() => {
      runEffect(() => (dummy = state.n))
      onScopeDispose(() => cleaned++)
    })
    expect(dummy).toBe(0)
    state.n = 1
    expect(dummy).toBe(1)
    scope.stop()
    state.n = 2
    expect(dummy).toBe(1) // effect 已停止
    expect(cleaned).toBe(1)
    scope.stop() // 幂等
    expect(cleaned).toBe(1)
  })
})

// ------------------------------------------------------------
// 7. toValue
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

// ------------------------------------------------------------
// 8. SVG 命名空间渲染
// ------------------------------------------------------------
describe('P0: SVG 命名空间渲染', () => {
  it('svg / circle 用 createElementNS 创建', () => {
    function App() {
      return (
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="red" />
        </svg>
      )
    }
    const host = mount(App)
    const svg = host.querySelector('svg')!
    const circle = host.querySelector('circle')!
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(circle.getAttribute('r')).toBe('40')
    expect(circle.getAttribute('fill')).toBe('red')
  })
})

// ------------------------------------------------------------
// 9. dangerouslySetInnerHTML
// ------------------------------------------------------------
describe('P0: dangerouslySetInnerHTML', () => {
  it('注入 HTML 字符串', () => {
    function App() {
      return <div dangerouslySetInnerHTML={{ __html: '<span class="x">hi</span>' }} />
    }
    const host = mount(App)
    const span = host.querySelector('.x')!
    expect(span.textContent).toBe('hi')
    expect(span.tagName.toLowerCase()).toBe('span')
  })

  it('更新 innerHTML 时替换内容', () => {
    const state = reactive({ html: '<b>a</b>' })
    function App() {
      return <div dangerouslySetInnerHTML={{ __html: state.html }} />
    }
    const host = mount(App)
    expect(host.querySelector('b')!.textContent).toBe('a')
    state.html = '<i>b</i>'
    return Promise.resolve().then(() => {
      expect(host.querySelector('i')!.textContent).toBe('b')
      expect(host.querySelector('b')).toBe(null)
    })
  })
})

// ------------------------------------------------------------
// 10. passive 事件修饰符
// ------------------------------------------------------------
describe('P0: passive 事件修饰符', () => {
  it('onScrollPassive 以 passive 监听', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    function App() {
      return <div onScrollPassive={() => {}} />
    }
    mount(App)
    const call = spy.mock.calls.find(
      ([type]) => type === 'scroll'
    ) as unknown as [string, any, any]
    expect(call).toBeTruthy()
    expect(call[2]).toEqual({ capture: false, passive: true })
    spy.mockRestore()
  })

  it('onClick 仍为普通监听（无 passive）', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    function App() {
      return <div onClick={() => {}} />
    }
    mount(App)
    const call = spy.mock.calls.find(
      ([type]) => type === 'click'
    ) as unknown as [string, any, any]
    expect(call).toBeTruthy()
    expect(call[2]).toEqual({ capture: false, passive: false })
    spy.mockRestore()
  })
})
