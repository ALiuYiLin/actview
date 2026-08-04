// ============================================================
// actview 框架回归测试（vitest + happy-dom）
//   场景 1-9 + 冒烟，原 scripts/verify.mjs（DOM stub）迁移而来
// 运行：pnpm test
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, watch, onMounted, onUpdated, onBeforeUnmount, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from 'actview'
import { runEffect } from '@actview/core'
import { createRouter, createMemoryHistory, RouterLink, RouterView } from '@actview/router'

/** 创建带 id 的宿主元素并挂载组件 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 场景 1：响应式文本自动更新
// ------------------------------------------------------------
describe('场景 1：响应式文本自动更新', () => {
  it('reactive 状态变化自动重跑 patch 更新 DOM', async () => {
    const state = reactive({ count: 1 })
    function App() {
      return (
        <div class="app">
          <span>hello: {state.count}</span>
          <input value={state.count} />
        </div>
      )
    }
    const host = mount('#s1', App)
    expect(collectText(host)).toContain('hello: 1')
    state.count = 42
    await nextTick()
    expect(collectText(host)).toContain('hello: 42')
    expect((host.children[0].children[1] as HTMLInputElement).value).toBe('42')
  })
})

// ------------------------------------------------------------
// 场景 2：keyed diff
// ------------------------------------------------------------
describe('场景 2：keyed diff', () => {
  it('按 key 复用 / 重排 / 增删', async () => {
    const state = reactive({ items: ['a', 'b', 'c'] })
    function ListApp() {
      return (
        <ul>
          {state.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
    }
    const host = mount('#s2', ListApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)
    expect(texts()).toEqual(['a', 'b', 'c'])
    const liA = ul.children[0] // 'a' 的 DOM 节点（用于复用断言）

    // 重排 c,a,b：LIS = [a,b]，只移动 c（insertBefore 恰好 1 次，不是整体重排）
    const insertSpy = vi.spyOn(ul, 'insertBefore')
    state.items = ['c', 'a', 'b']
    await nextTick()
    expect(texts()).toEqual(['c', 'a', 'b'])
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(ul.children[1]).toBe(liA) // 'a' 的 li 复用，未被重建
    insertSpy.mockRestore()

    state.items = ['a', 'd']
    await nextTick()
    expect(texts()).toEqual(['a', 'd'])

    state.items = ['x', 'a', 'd']
    await nextTick()
    expect(texts()).toEqual(['x', 'a', 'd'])
  })

  it('4 元素重排只移动最小节点数', async () => {
    const state = reactive({ items: ['a', 'b', 'c', 'd'] })
    function ListApp() {
      return (
        <ul>
          {state.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
    }
    const host = mount('#s2b', ListApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)
    expect(texts()).toEqual(['a', 'b', 'c', 'd'])

    // a,b,c,d → a,c,d,b：LIS = [a,c,d]（旧下标 0,2,3），仅 b 需移动
    const insertSpy = vi.spyOn(ul, 'insertBefore')
    state.items = ['a', 'c', 'd', 'b']
    await nextTick()
    expect(texts()).toEqual(['a', 'c', 'd', 'b'])
    expect(insertSpy).toHaveBeenCalledTimes(1)
    insertSpy.mockRestore()

    // 全部逆序：a,c,d,b → b,d,c,a，至少 3 次移动但不超过列表长度
    const spy2 = vi.spyOn(ul, 'insertBefore')
    state.items = ['b', 'd', 'c', 'a']
    await nextTick()
    expect(texts()).toEqual(['b', 'd', 'c', 'a'])
    expect(spy2.mock.calls.length).toBeLessThan(4)
    spy2.mockRestore()
  })
})

// ------------------------------------------------------------
// 场景 3：props 细粒度更新
// ------------------------------------------------------------
describe('场景 3：props 细粒度更新', () => {
  it('setup 只执行一次，props 更新不重挂', async () => {
    let childSetupCount = 0
    function Child(props: { msg: string }) {
      childSetupCount++
      return <span class="child">{props.msg}</span>
    }
    const state = reactive({ msg: 'hello' })
    function Parent() {
      return <div class="parent"><Child msg={state.msg} /></div>
    }
    const host = mount('#s3', Parent)
    const span = host.children[0].children[0]
    expect(childSetupCount).toBe(1)
    expect(span.textContent).toBe('hello')

    state.msg = 'world'
    await nextTick()
    expect(span.textContent).toBe('world')
    expect(childSetupCount).toBe(1)
    expect(host.children[0].children[0]).toBe(span) // DOM 复用
  })
})

// ------------------------------------------------------------
// 场景 4：依赖隔离
// ------------------------------------------------------------
describe('场景 4：依赖隔离', () => {
  it('子组件内部状态变化不连带父组件重渲染', async () => {
    let parentRenderCount = 0
    function markParentRender() {
      parentRenderCount++
      return ''
    }
    const innerState = reactive({ local: 'inner' })
    function ChildWithLocal(props: { msg: string }) {
      return (
        <div class="child-local">
          <span>prop: {props.msg} | local: {innerState.local}</span>
        </div>
      )
    }
    const parentState = reactive({ msg: 'hello2' })
    function ParentWithLocal() {
      return (
        <div class="parent-local">
          {markParentRender()}
          <ChildWithLocal msg={parentState.msg} />
        </div>
      )
    }
    const host = mount('#s4', ParentWithLocal)
    expect(parentRenderCount).toBe(1)

    innerState.local = 'changed'
    await nextTick()
    expect(collectText(host)).toContain('local: changed')
    expect(parentRenderCount).toBe(1)

    parentState.msg = 'hello2!'
    await nextTick()
    expect(collectText(host)).toContain('prop: hello2!')
    expect(parentRenderCount).toBe(2)

    // 核心：props 更新路径之后，子内部状态再变化不得连带父组件
    innerState.local = 'again'
    await nextTick()
    expect(collectText(host)).toContain('local: again')
    expect(parentRenderCount).toBe(2)
  })
})

// ------------------------------------------------------------
// 场景 5：路由（RouterView 组件切换）
// ------------------------------------------------------------
describe('场景 5：路由', () => {
  it('RouterView 切换 / 动态参数 / back / link', async () => {
    function Home() { return <div class="page home">Home page</div> }
    function About() { return <div class="page about">About page</div> }
    function User(props: { params: Record<string, string> }) {
      return <div class="page user">User: {props.params.id}</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/about', component: About },
        { path: '/user/:id', component: User },
      ],
    })
    function RouterApp() {
      return (
        <div class="router-app">
          <nav>
            <RouterLink to="/">Home</RouterLink>
            <RouterLink to="/about">About</RouterLink>
          </nav>
          <RouterView />
        </div>
      )
    }
    const host = mount('#s5', RouterApp)
    expect(collectText(host)).toContain('Home page')

    router.push('/about')
    await nextTick()
    expect(collectText(host)).toContain('About page')

    router.push('/user/42')
    await nextTick()
    expect(collectText(host)).toContain('User: 42')

    router.back()
    await nextTick()
    expect(collectText(host)).toContain('About page')

    const nav = host.children[0].children[0] as HTMLElement
    ;(nav.children[0] as HTMLAnchorElement).dispatchEvent(new Event('click'))
    await nextTick()
    expect(collectText(host)).toContain('Home page')
    expect((nav.children[0] as HTMLAnchorElement).getAttribute('href')).toBe('/')
  })
})

// ------------------------------------------------------------
// 场景 6：数组方法响应
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
// 场景 7：for...in / in 响应
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
// 场景 8：markRaw / readonly / shallowReactive / 非普通对象
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

// ------------------------------------------------------------
// 场景 9：受控 input 光标保位
// ------------------------------------------------------------
describe('场景 9：受控 input 光标保位', () => {
  it('聚焦时赋值后恢复光标，未聚焦不干预', async () => {
    const state = reactive({ text: 'abc' })
    function InputApp() {
      return (
        <div class="input-app">
          <input value={state.text} oninput={(e) => { state.text = e.target.value }} />
        </div>
      )
    }
    const host = mount('#s9', InputApp)
    const inputEl = host.children[0].children[0] as HTMLInputElement
    expect(inputEl.value).toBe('abc')

    // 聚焦：光标在位置 1，state 值变化 =》 patch 赋值后光标保持
    inputEl.focus()
    inputEl.setSelectionRange(1, 1)
    state.text = 'aXc'
    await nextTick()
    expect(inputEl.value).toBe('aXc')
    expect(inputEl.selectionStart).toBe(1)

    // 未聚焦：value 更新但光标不被恢复逻辑干预（happy-dom 与真实浏览器一致：
    // 赋值后光标重置，此处为末尾 4；关键是未被还原成记录值 2）
    ;(document.activeElement as HTMLElement)?.blur()
    inputEl.value = 'aXc'
    inputEl.setSelectionRange(2, 2)
    state.text = 'abXc'
    await nextTick()
    expect(inputEl.value).toBe('abXc')
    expect(inputEl.selectionStart).not.toBe(2)
  })
})

// ------------------------------------------------------------
// 场景 10：调度批处理 + nextTick
// ------------------------------------------------------------
describe('场景 10：调度批处理', () => {
  it('同轮多次修改状态只触发一次更新；nextTick 在更新后回调', async () => {
    let renderCount = 0
    function markRender() {
      renderCount++
      return ''
    }
    const state = reactive({ count: 0 })
    function Counter() {
      return <div class="counter">{markRender()}{state.count}</div>
    }
    const host = mount('#s10', Counter)
    expect(renderCount).toBe(1) // 首次挂载同步渲染

    state.count++
    state.count++
    state.count++
    expect(renderCount).toBe(1) // 批处理：修改后同步时刻尚未重渲染
    await nextTick()
    expect(renderCount).toBe(2) // 微任务中只更新一次（去重）
    expect(collectText(host)).toContain('3')

    let called = false
    state.count++
    await nextTick(() => { called = true })
    expect(called).toBe(true) // nextTick 回调在 flush 后执行
    expect(renderCount).toBe(3)
  })
})

// ------------------------------------------------------------
// 冒烟：src/main.tsx 检验页（路由版）
// ------------------------------------------------------------
describe('冒烟：src/main.tsx 检验页', () => {
  it('路由版页面渲染与路由切换', async () => {
    const appHost = document.createElement('div')
    appHost.id = 'app'
    document.body.appendChild(appHost)

    await import('../src/main.tsx')
    const routerMod = await import('../src/router.ts')

    const appRoot = document.querySelector('#app')!
    expect(collectText(appRoot)).toContain('框架能力总览')
    expect(collectText(appRoot)).toContain('① 响应式')

    routerMod.router.push('/reactive')
    await nextTick()
    expect(collectText(appRoot)).toContain('count =')

    routerMod.router.push('/list')
    await nextTick()
    expect(collectText(appRoot)).toContain('Apple')
  })
})

// ------------------------------------------------------------
// 场景 11：事件系统（addEventListener + capture + invoker 复用 + 统一解绑）
// ------------------------------------------------------------
describe('场景 11：事件系统', () => {
  it('绑定/capture/换 handler 不重绑/解绑', async () => {
    const state = reactive({ count: 0, enabled: true })
    function App() {
      return (
        <button
          onClick={state.enabled ? () => state.count++ : undefined}
          onMouseDownCapture={() => (state.count += 10)}
        >
          btn
        </button>
      )
    }

    // mount 后 spy 实例方法（happy-dom 事件方法在深层原型，原型 spy 不可靠）
    const host = mount('#s11', App)
    const btn = host.children[0] as HTMLButtonElement

    // 初始绑定生效（行为验证：dispatch 触发 handler）
    btn.dispatchEvent(new Event('click'))
    expect(state.count).toBe(1)
    btn.dispatchEvent(new Event('mousedown'))
    expect(state.count).toBe(11)

    // 重渲染：handler 换新闭包，invoker 复用 → 不重新 addEventListener
    const addSpy = vi.spyOn(btn, 'addEventListener')
    state.count = 100 // 触发 App 重渲染，onClick / onMouseDownCapture 均为新函数
    await nextTick()
    expect(addSpy).not.toHaveBeenCalled()

    // 解绑：enabled=false → onClick 移除并停止触发
    const removeSpy = vi.spyOn(btn, 'removeEventListener')
    state.enabled = false
    await nextTick()
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), false)
    btn.dispatchEvent(new Event('click'))
    expect(state.count).toBe(100) // click 不再 +1
    btn.dispatchEvent(new Event('mousedown'))
    expect(state.count).toBe(110) // mousedown 仍 +10

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ------------------------------------------------------------
// 场景 12：生命周期钩子
// ------------------------------------------------------------
describe('场景 12：生命周期钩子', () => {
  it('onMounted / onUpdated / onBeforeUnmount 按时机触发', async () => {
    const log: string[] = []
    const state = reactive({ show: true, count: 0 })
    function Child() {
      onMounted(() => log.push('mounted'))
      onUpdated(() => log.push('updated'))
      onBeforeUnmount(() => log.push('beforeUnmount'))
      return <span>{state.count}</span>
    }
    function App() {
      return <div>{state.show ? <Child /> : null}</div>
    }
    const host = mount('#s12', App)

    expect(log).toEqual(['mounted']) // 首次挂载只触发 mounted

    state.count = 1
    await nextTick()
    expect(log).toEqual(['mounted', 'updated']) // 状态变化触发 updated

    state.show = false // 卸载 Child
    await nextTick()
    expect(log).toEqual(['mounted', 'updated', 'beforeUnmount'])
  })
})

// ------------------------------------------------------------
// 场景 13：computed / ref / watch
// ------------------------------------------------------------
describe('场景 13：computed / ref / watch', () => {
  it('computed 缓存 + ref 响应式 + watch 回调与 cleanup', async () => {
    const state = reactive({ count: 1 })
    const double = computed(() => state.count * 2)
    const countRef = ref(0)
    const watchLog: string[] = []
    let cleanupRan = false

    watch(() => state.count, (n, o) => watchLog.push(`count:${o}->${n}`))
    watch(
      countRef,
      (n, o, onCleanup) => {
        onCleanup(() => {
          cleanupRan = true
        })
        watchLog.push(`ref:${o}->${n}`)
      },
      { immediate: true },
    )

    function App() {
      return (
        <div>
          <span>double:{double.value}</span>
          <span>ref:{countRef.value}</span>
        </div>
      )
    }
    const host = mount('#s13', App)
    expect(collectText(host)).toContain('double:2')
    expect(collectText(host)).toContain('ref:0')
    expect(watchLog).toEqual(['ref:undefined->0']) // immediate 首次触发

    state.count = 3
    countRef.value = 5
    await nextTick()
    expect(collectText(host)).toContain('double:6')
    expect(collectText(host)).toContain('ref:5')
    await nextTick() // watch 独立微任务，等其跑完
    expect(watchLog).toEqual([
      'ref:undefined->0',
      'count:1->3',
      'ref:0->5',
    ])

    // cleanup：下一次触发前执行上一次注册的清理
    cleanupRan = false
    countRef.value = 9
    await nextTick()
    await nextTick()
    expect(cleanupRan).toBe(true)
    expect(watchLog).toEqual([
      'ref:undefined->0',
      'count:1->3',
      'ref:0->5',
      'ref:5->9',
    ])
  })
})

// ------------------------------------------------------------
// 场景 14：插槽 / 动态组件 / keep-alive
// ------------------------------------------------------------
describe('场景 14：插槽与动态组件', () => {
  it('默认插槽透传 + 作用域插槽（函数 children）', () => {
    // 作用域插槽：children 是函数，组件内调用并传入作用域数据（render-prop）
    function List(props: any) {
      return (
        <ul>
          {props.items.map((item: string, i: number) => (
            <li key={item}>{props.children({ item, i })}</li>
          ))}
        </ul>
      )
    }
    function App() {
      return (
        <div>
          <List items={['a', 'b']}>
            {(scope: any) => <b>{scope.i}:{scope.item}</b>}
          </List>
        </div>
      )
    }
    const host = mount('#s14a', App)
    expect(collectText(host)).toContain('0:a')
    expect(collectText(host)).toContain('1:b')
  })

  it('动态组件 <component is> 切换', async () => {
    const state = reactive({ view: 'a' })
    function A() {
      return <span>CompA</span>
    }
    function B() {
      return <span>CompB</span>
    }
    function App() {
      return <div><component is={state.view === 'a' ? A : B} /></div>
    }
    const host = mount('#s14b', App)
    expect(collectText(host)).toContain('CompA')
    state.view = 'b'
    await nextTick()
    expect(collectText(host)).toContain('CompB')
    state.view = 'a'
    await nextTick()
    expect(collectText(host)).toContain('CompA')
  })

  it('keep-alive 缓存实例：切换不重建、缓存期间更新仍生效', async () => {
    const state = reactive({ view: 'a', count: 0 })
    let aMounted = 0
    function A() {
      onMounted(() => aMounted++)
      return <div>CompA({state.count})</div>
    }
    function B() {
      return <div>CompB</div>
    }
    function App() {
      return (
        <div><KeepAlive><component is={state.view === 'a' ? A : B} /></KeepAlive></div>
      )
    }
    const host = mount('#s14c', App)
    expect(collectText(host)).toContain('CompA(0)')
    expect(aMounted).toBe(1)
    const aDiv = host.children[0].children[0] // A 的根 DOM

    state.view = 'b'
    await nextTick()
    expect(collectText(host)).toContain('CompB')
    expect(aDiv.parentNode).not.toBe(host.children[0]) // A 的 DOM 已移入隐藏容器

    state.count = 5 // 缓存期间 A 的 effect 仍响应（隐藏容器内更新）
    await nextTick()

    state.view = 'a'
    await nextTick()
    expect(collectText(host)).toContain('CompA(5)')
    expect(aMounted).toBe(1) // 不重建：onMounted 只触发一次
    expect(host.children[0].children[0]).toBe(aDiv) // DOM 复用
  })
})

// ------------------------------------------------------------
// 场景 15：错误边界 / Suspense / lazy / ref
// ------------------------------------------------------------
describe('场景 15：错误边界 / Suspense / lazy / ref', () => {
  it('ErrorBoundary 捕获子组件渲染错误并显示 fallback', async () => {
    const state = reactive({ boom: false })
    function throwBoom() {
      throw new Error('boom!')
    }
    // 抛错放在 JSX 表达式内（render 期执行、被渲染 effect 跟踪）；
    // 组件函数体顶层是 setup 体（只执行一次），不会在更新时重跑
    function Broken() {
      return <span>{state.boom ? throwBoom() : 'ok'}</span>
    }
    function App() {
      return (
        <div>
          <ErrorBoundary fallback={<b>出错了</b>}>
            <Broken />
          </ErrorBoundary>
        </div>
      )
    }
    const host = mount('#s15a', App)
    expect(collectText(host)).toContain('ok')

    state.boom = true // 子组件渲染抛错 → 边界捕获并显示 fallback
    await nextTick()
    expect(collectText(host)).toContain('出错了')
    expect(collectText(host)).not.toContain('ok')
  })

  it('ref 模板引用指向 DOM', () => {
    let elRef: any = null
    function App() {
      return <div><input ref={(el) => { elRef = el }} /></div>
    }
    const host = mount('#s15b', App)
    expect(elRef).toBe(host.children[0].children[0])
    expect(elRef.tagName).toBe('INPUT')
  })

  it('Suspense + lazy 异步组件：fallback → loaded', async () => {
    let resolveLoader!: (m: any) => void
    const LazyComp = lazy(() => new Promise((res) => { resolveLoader = res }))
    function App() {
      return (
        <div>
          <Suspense fallback={<span>loading...</span>}>
            <LazyComp />
          </Suspense>
        </div>
      )
    }
    const host = mount('#s15c', App)

    // lazy 注册 pending → Suspense 显示 fallback
    await nextTick()
    expect(collectText(host)).toContain('loading...')

    // loader 完成 → Suspense resolve → 渲染真实组件（defineComponent 约定 setup 返回 render 函数）
    resolveLoader({ default: defineComponent(function Loaded() { return () => <i>loaded!</i> }) })
    await nextTick()
    await nextTick()
    expect(collectText(host)).toContain('loaded!')
  })
})

// ------------------------------------------------------------
// 场景 16：类型泛型化（编译期验证）
//   @ts-expect-error 反向断言：若下一行没有类型错误，tsc 会报
//   "Unused @ts-expect-error directive" → 编译失败，
//   从而在编译期验证 JSX props 推导与事件类型检查确实生效
// ------------------------------------------------------------
describe('场景 16：类型泛型化（编译期）', () => {
  it('组件 props 推导 + 事件类型检查', () => {
    function Child(props: { msg: string; onSave?: (v: string) => void }) {
      return <span>{props.msg}</span>
    }

    // 合法用法：msg 类型正确，onSave 回调参数推导为 string
    const ok = <Child msg="hi" onSave={(v) => v.toUpperCase()} />
    expect(ok).toBeTruthy()

    // @ts-expect-error msg 应为 string
    const bad1 = <Child msg={123} />
    expect(bad1).toBeTruthy()

    // @ts-expect-error onSave 参数应为 string
    const bad2 = <Child onSave={(n: number) => n.toFixed()} />
    expect(bad2).toBeTruthy()

    // @ts-expect-error onClick 参数应为 MouseEvent
    const bad3 = <button onClick={(e: number) => {}} />
    expect(bad3).toBeTruthy()

    // 事件参数推导：e 为 MouseEvent（可访问 target）
    const evt = <button onClick={(e) => (e.target as HTMLElement).tagName} />
    expect(evt).toBeTruthy()

    // @ts-expect-error input 的 type 有枚举约束
    const bad4 = <input type={123} />
    expect(bad4).toBeTruthy()

    // 合法：input 专属属性
    const okInput = <input type="checkbox" checked={true} />
    expect(okInput).toBeTruthy()
  })
})

// ------------------------------------------------------------
// 场景 17：effect 内修改数组不爆栈（pauseTracking + 重入保护）
// ------------------------------------------------------------
describe('场景 17：effect 内修改数组', () => {
  it('runEffect 内 push 自身依赖数组不爆栈、不无限重入', () => {
    const state = reactive({ items: [1] })
    let runs = 0
    const e = runEffect(() => {
      runs++
      state.items.push(state.items.length)
    })
    // 重入保护：修改自身的 effect 不因自身 push 的 trigger 同步重跑
    expect(runs).toBe(1)
    expect(state.items).toEqual([1, 1]) // push 恰好执行一次
    e.stop()
  })

  it('push 的 effect 不重入，其他依赖该数组的 effect 正常触发', () => {
    const state = reactive({ items: [1] })
    const seen: number[][] = []
    const reader = runEffect(() => seen.push(state.items.slice()))
    const pusher = runEffect(() => state.items.push(9))

    expect(state.items).toEqual([1, 9])
    // reader 首次读到 [1]，随后被 push 触发重跑并读到最新 [1,9]
    // （push 内部索引+length 两次 set 会触发多次重跑，但每次都读到最新值）
    expect(seen[0]).toEqual([1])
    expect(seen[seen.length - 1]).toEqual([1, 9])
    // pusher 自身不重入：数组里恰好一个 9
    expect(state.items.filter((i) => i === 9)).toHaveLength(1)

    // 只停 pusher（避免 push(10) 触发它重跑再 push(9)）；reader 保持响应
    pusher.stop()
    state.items.push(10)
    expect(seen[seen.length - 1]).toEqual([1, 9, 10])
    reader.stop()
  })

  it('组件渲染内 push 不导致渲染无限循环', async () => {
    const state = reactive({ items: [1] })
    function App() {
      state.items.push(state.items.length) // 渲染期内 push（反模式，但不应崩）
      return <ul>{state.items.map((i) => <li key={i}>{i}</li>)}</ul>
    }
    const host = document.createElement('div')
    host.id = 's17'
    document.body.appendChild(host)
    createApp(App).mount('#s17')
    expect(collectText(host)).toContain('1')
  })
})

// ------------------------------------------------------------
// 场景 18：同索引 diff 文本定位（vnode 级 children 缓存）
//   Bug 2（纯文本/混排列表错位）与 Bug 3（Fragment 内文本索引偏移）
//   根因相同：文本 vnode 的 el 未跨 diff 持久化，退化用 childNodes[index] 猜测
// ------------------------------------------------------------
describe('场景 18：同索引 diff 文本定位', () => {
  it('Fragment 混排更新不再错位（Bug 3）', async () => {
    const state = reactive({ n: 1 })
    function App() {
      return <div><span>A</span><>{[state.n, 'B']}</><span>C</span></div>
    }
    const host = mount('#s18a', App)
    expect(collectText(host)).toBe('A1BC')

    state.n = 99
    await nextTick()
    expect(collectText(host)).toBe('A99BC') // 修复前错误为 '99BBC'
    expect((host.children[0].children[0] as HTMLElement).textContent).toBe('A') // spanA 未被误改
  })

  it('纯文本数组增删中间项显示与节点数正确（Bug 2）', async () => {
    const state = reactive({ list: ['a', 'b', 'c'] })
    function App() {
      return <div>{state.list}</div>
    }
    const host = mount('#s18b', App)
    expect(host.children[0].textContent).toBe('abc')

    state.list = ['a', 'x', 'b', 'c']
    await nextTick()
    expect(host.children[0].textContent).toBe('axbc')

    state.list = ['a', 'x'] // 删除尾部：多余文本节点被移除
    await nextTick()
    expect(host.children[0].textContent).toBe('ax')
    expect(host.children[0].childNodes.length).toBe(2)
  })

  it('无 key 元素列表保持标准行为（文本正确、节点按索引复用）', async () => {
    const state = reactive({ list: ['a', 'b', 'c'] })
    function App() {
      return <ul>{state.list.map((i) => <li>{i}</li>)}</ul>
    }
    const host = mount('#s18c', App)
    const ul = host.children[0]
    const liA = ul.children[0]

    state.list = ['a', 'x', 'b', 'c']
    await nextTick()
    expect(Array.from(ul.children).map((li) => li.textContent).join(',')).toBe('a,x,b,c')
    expect(ul.children.length).toBe(4)
    expect(ul.children[0]).toBe(liA) // 首项复用（无 key 的标准索引语义）
  })
})

// ------------------------------------------------------------
// 场景 19：空文本节点（Bug 4：不残留空文本节点）
// ------------------------------------------------------------
describe('场景 19：空文本节点', () => {
  it('文本置空后移除节点、恢复后重建', async () => {
    const state = reactive({ s: 'abc' })
    function App() {
      return <div>{state.s}</div>
    }
    const host = mount('#s19a', App)
    const div = host.children[0]
    expect(div.textContent).toBe('abc')
    expect(div.childNodes.length).toBe(1)

    state.s = '' // 置空：移除空文本节点，不残留
    await nextTick()
    expect(div.textContent).toBe('')
    expect(div.childNodes.length).toBe(0) // 修复前残留 1 个空文本节点

    state.s = 'xyz' // 恢复：重新创建文本节点
    await nextTick()
    expect(div.textContent).toBe('xyz')
    expect(div.childNodes.length).toBe(1)
  })

  it('首次挂载即空文本不创建节点', () => {
    const state = reactive({ s: '' })
    function App() {
      return <div>{state.s}</div>
    }
    const host = mount('#s19b', App)
    expect(host.children[0].childNodes.length).toBe(0)
  })

  it('列表中间空文本增删后其余项不错位', async () => {
    const state = reactive({ list: ['a', '', 'b'] })
    function App() {
      return <div>{state.list}</div>
    }
    const host = mount('#s19c', App)
    const div = host.children[0]
    expect(div.childNodes.length).toBe(2) // 中间空文本不建节点

    state.list = ['a', 'x', 'b'] // 空文本位置插入 x：锚点为 childNodes[1]（b）
    await nextTick()
    expect(div.textContent).toBe('axb')

    state.list = ['a', 'x', 'b', 'c'] // 尾部追加
    await nextTick()
    expect(div.textContent).toBe('axbc')
    expect(div.childNodes.length).toBe(4)
  })
})

// ------------------------------------------------------------
// 场景 20：具名插槽（<template slot="name"> 编译期转换 → slots prop）
// ------------------------------------------------------------
describe('场景 20：具名插槽', () => {
  it('具名插槽 + 默认插槽分发', () => {
    function Card(props: any) {
      return (
        <div class="card">
          <div class="header">{props.slots?.header?.()}</div>
          <div class="body">{props.children}</div>
          <div class="footer">{props.slots?.footer?.()}</div>
        </div>
      )
    }
    function App() {
      return (
        <Card>
          <template slot="header">标题</template>
          <template slot="footer">页脚</template>
          正文内容
        </Card>
      )
    }
    const host = mount('#s20a', App)
    const card = host.children[0] as HTMLElement
    expect((card.children[0] as HTMLElement).textContent).toBe('标题') // header 插槽
    expect((card.children[1] as HTMLElement).textContent).toBe('正文内容') // 默认插槽
    expect((card.children[2] as HTMLElement).textContent).toBe('页脚') // footer 插槽
  })

  it('具名作用域插槽（template 无值属性声明参数）', () => {
    function List(props: any) {
      return (
        <ul>
          {props.items.map((item: string, i: number) => (
            <li key={i}>{props.slots?.item?.(item, i)}</li>
          ))}
        </ul>
      )
    }
    function App() {
      return (
        <List items={['a', 'b']}>
          <template slot="item" item i>
            <b>{i}:{item}</b>
          </template>
        </List>
      )
    }
    const host = mount('#s20b', App)
    const ul = host.children[0] as HTMLUListElement
    expect(Array.from(ul.children).map((li) => li.textContent).join(',')).toBe('0:a,1:b')
  })

  it('默认插槽 + 具名插槽混合', () => {
    function Panel(props: any) {
      return (
        <div>
          {props.slots?.title?.() ?? null}
          {props.children}
        </div>
      )
    }
    function App() {
      return (
        <Panel>
          <template slot="title">Title!</template>
          Body
        </Panel>
      )
    }
    const host = mount('#s20c', App)
    expect(host.children[0].textContent).toBe('Title!Body')
  })
})
