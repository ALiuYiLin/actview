// ============================================================
// actview 框架回归测试（vitest + happy-dom）
//   场景 1-9 + 冒烟，原 scripts/verify.mjs（DOM stub）迁移而来
// 运行：pnpm test
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from 'actview'
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

  it('扩展能力页（⑤-⑩）渲染与交互', async () => {
    // main.tsx 固定挂载 #app：若已被前一个用例创建则复用
    if (!document.querySelector('#app')) {
      const h = document.createElement('div')
      h.id = 'app'
      document.body.appendChild(h)
    }
    await import('../src/main.tsx')
    const routerMod = await import('../src/router.ts')
    const appRoot = document.querySelector('#app')!
    const cases: [string, string][] = [
      ['/api', '响应式 API'],
      ['/array', '数组方法'],
      ['/slot', '插槽'],
      ['/home', '响应式'],
      ['/dynamic', 'keep-alive'],
      ['/async', '错误边界'],
    ]
    for (const [path, keyword] of cases) {
      routerMod.router.push(path)
      await nextTick()
      expect(collectText(appRoot)).toContain(keyword)
    }
    // 异步组件 1s 加载完成后渲染真实组件
    await new Promise((r) => setTimeout(r, 1200))
    await nextTick()
    expect(collectText(appRoot)).toContain('异步组件加载完成')
    // 错误边界：触发渲染错误 → fallback
    const boomBtn = Array.from(appRoot.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('触发渲染错误'),
    )
    boomBtn?.dispatchEvent(new Event('click'))
    await nextTick()
    expect(collectText(appRoot)).toContain('渲染出错')
  })

  it('生命周期页交互：挂载/更新/卸载计数即时刷新', async () => {
    if (!document.querySelector('#app')) {
      const h = document.createElement('div')
      h.id = 'app'
      document.body.appendChild(h)
    }
    await import('../src/main.tsx')
    const routerMod = await import('../src/router.ts')
    const appRoot = document.querySelector('#app')!
    const click = (label: string) => {
      const btn = Array.from(appRoot.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(label),
      )
      btn?.dispatchEvent(new Event('click'))
    }

    routerMod.router.push('/lifecycle')
    await nextTick()
    // 进入页面：Child 挂载完成 → onMounted=1（响应式计数即时显示）
    expect(collectText(appRoot)).toContain('onMounted=1 次')
    expect(collectText(appRoot)).toContain('onUpdated=0 次')
    expect(collectText(appRoot)).toContain('onBeforeUnmount=0 次')

    // 触发 Child 更新（Child 读 state.n）→ onUpdated=1
    click('触发 Child 更新')
    await nextTick()
    expect(collectText(appRoot)).toContain('onUpdated=1 次')

    // 卸载 Child → onBeforeUnmount=1
    click('卸载 Child')
    await nextTick()
    expect(collectText(appRoot)).toContain('onBeforeUnmount=1 次')

    // 重新挂载 → onMounted=2（新实例重新注册钩子）
    click('挂载 Child')
    await nextTick()
    expect(collectText(appRoot)).toContain('onMounted=2 次')
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

  it('onUpdated 钩子里改「父组件渲染依赖」的响应式不无限循环（pauseTracking 回归）', async () => {
    // 反模式场景：钩子执行期间框架暂停依赖收集（对齐 Vue 3 post 队列语义）。
    // 若不停 track，`counts.updated++` 的「读」会把它 track 进 Child 渲染 effect，
    // 写时触发自身 =》 无限循环崩溃。
    const state = reactive({ n: 0 })
    const counts = reactive({ updated: 0 })
    let childRuns = 0
    let pageRuns = 0
    function Child() {
      onUpdated(() => counts.updated++)
      return <span>{(childRuns++, state.n)}</span>
    }
    function App() {
      return <div>{(pageRuns++, 'upd:' + counts.updated)}
        <Child />
      </div>
    }
    const host = mount('#s12b', App)
    expect(counts.updated).toBe(0)

    state.n++
    await nextTick()
    await nextTick()

    // Child 只渲染一次（state.n 触发），Page 因 counts.updated 变化重渲染一次
    expect(childRuns).toBe(2)
    expect(pageRuns).toBe(2)
    expect(counts.updated).toBe(1) // 不循环：updated 恰好 1 次
    expect(host.textContent).toContain('upd:1')
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

  it('keep-alive 多组件循环切换（动态组件 key 冲突回归）', async () => {
    // 回归：<component is> 的 vnode type 是 'component'（未解析），
    // 若缓存 key 直接取 type，A/B/C 共享同一 key 互相覆盖 → 切换错乱
    const state = reactive({ tab: 'a' })
    function A() {
      return <div>CompA</div>
    }
    function B() {
      return <div>CompB</div>
    }
    function C() {
      return <div>CompC</div>
    }
    function App() {
      return (
        <KeepAlive>
          <component is={state.tab === 'a' ? A : state.tab === 'b' ? B : C} />
        </KeepAlive>
      )
    }
    const host = mount('#s14d', App)
    const expectTab = async (tab: string, text: string) => {
      state.tab = tab
      await nextTick()
      expect(collectText(host)).toContain(text)
      expect(host.children.length).toBe(1) // 每轮只保留一个活动组件 DOM（不累积）
    }
    // 循环三组件两轮：每次都应渲染目标组件且不累积 DOM
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
    // 第三轮（回归：缓存命中复用后重新标记，否则实例被真卸载导致 replace 重建累积）
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
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

// ------------------------------------------------------------
// 场景 21：EffectScope — 组件卸载自动停止 watch/computed/render effect
// ------------------------------------------------------------
describe('场景 21：EffectScope 自动停止', () => {
  it('组件卸载后 watch 自动停止（回调不再触发）', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    const ui = reactive({ on: true })
    function Child() {
      watch(() => state.n, (v) => log.push(`child:${v}`))
      return <span>child</span>
    }
    function App() {
      return <div>{ui.on ? <Child /> : null}</div>
    }
    const host = mount('#s21a', App)

    state.n = 1
    await nextTick()
    expect(log).toEqual(['child:1']) // 挂载期间 watch 生效

    ui.on = false // 卸载 Child → scope.stop → watch 自动停止
    await nextTick()
    state.n = 2
    await nextTick()
    expect(log).toEqual(['child:1']) // 不再触发（修复前会追加 'child:2'）
  })

  it('computed 随组件卸载停止重算；组件外 watch 不受影响', async () => {
    const state = reactive({ n: 1 })
    let computedRuns = 0
    const externalWatchLog: string[] = []
    // 组件外 watch：不绑定任何 scope，手动管理
    const stopExternal = watch(() => state.n, (v) => externalWatchLog.push(v))

    function Child() {
      const double = computed(() => {
        computedRuns++
        return state.n * 2
      })
      return <span>{double.value}</span>
    }
    const ui = reactive({ on: true })
    function App() {
      return <div>{ui.on ? <Child /> : null}</div>
    }
    const host = mount('#s21b', App)
    expect(collectText(host)).toContain('2')
    expect(computedRuns).toBe(1)

    ui.on = false // 卸载 Child：computed 的 effect 停止
    await nextTick()
    const runsAfterUnmount = computedRuns
    state.n = 10
    await nextTick()
    expect(computedRuns).toBe(runsAfterUnmount) // computed 不再重算

    await nextTick()
    expect(externalWatchLog).toContain(10) // 组件外 watch 仍生效（需手动 stop）
    stopExternal()
  })
})

// ------------------------------------------------------------
// 场景 22：toRef / toRefs（对象属性转 ref）
// ------------------------------------------------------------
describe('场景 22：toRef / toRefs', () => {
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
})

// ------------------------------------------------------------
// 场景 22：renderToString（构建期 VNode→HTML 静态序列化）
// ------------------------------------------------------------
describe('场景 22：renderToString 构建期静态序列化', () => {
  it('原生标签 + 属性（class/style/布尔/事件跳过）+ 文本转义', () => {
    const html = renderToString(
      <div class="card" style={{ color: 'red', fontSize: '12px' }} onclick={() => {}} data-id="1">
        hello <b>&</b>
      </div>,
    )
    expect(html).toBe(
      '<div class="card" style="color:red;fontSize:12px" data-id="1">hello <b>&amp;</b></div>',
    )
  })

  it('空值/布尔/void 元素语义对齐 setProp', () => {
    const html = renderToString(
      <div>
        <input type="text" value="a" disabled={true} readonly={false} placeholder={null} />
        <br />
        <img src="/x.png" alt="" />
        <span hidden={true}>x</span>
      </div>,
    )
    expect(html).toBe(
      '<div><input type="text" value="a" disabled><br><img src="/x.png" alt=""><span hidden>x</span></div>',
    )
  })

  it('Fragment 拼接 + className 归一化为 class', () => {
    const html = renderToString(
      <>
        <span className="a">1</span>
        {null}
        {false}
        {42}
        <i>2</i>
      </>,
    )
    expect(html).toBe('<span class="a">1</span>42<i>2</i>')
  })

  it('静态组件：__setup + render 递归（无副作用场景）', () => {
    function Greet(props: { name: string }) {
      return <p class="greet">Hi, {props.name}</p>
    }
    const html = renderToString(<Greet name="actview" />)
    expect(html).toBe('<p class="greet">Hi, actview</p>')
  })

  it('children 数组 + 嵌套结构', () => {
    const html = renderToString(
      <ul>
        {[1, 2].map((n) => (
          <li key={n}>item{n}</li>
        ))}
      </ul>,
    )
    expect(html).toBe('<ul><li>item1</li><li>item2</li></ul>')
  })
})

// ------------------------------------------------------------
// 场景 23：Teleport / Transition 处置
// ------------------------------------------------------------
describe('场景 23：Teleport / Transition', () => {
  it('Teleport：children 渲染到目标容器，卸载时移除', async () => {
    const target = document.createElement('div')
    target.id = 'tele-target'
    document.body.appendChild(target)

    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-app">
          {state.show ? (
            <Teleport to="#tele-target">
              <span class="tele-item">传送到目标</span>
            </Teleport>
          ) : null}
        </div>
      )
    }
    const host = mount('#s23a', App)

    // 源码位置无内容，目标容器有内容
    expect(host.querySelector('.tele-item')).toBeNull()
    expect(target.querySelector('.tele-item')?.textContent).toBe('传送到目标')

    state.show = false
    await nextTick()
    expect(target.querySelector('.tele-item')).toBeNull()
  })

  it('Teleport：to 切换迁移 DOM 到新目标', async () => {
    const t1 = document.createElement('div')
    t1.id = 'tele-t1'
    const t2 = document.createElement('div')
    t2.id = 'tele-t2'
    document.body.appendChild(t1)
    document.body.appendChild(t2)

    const state = reactive({ target: '#tele-t1' })
    function App() {
      return (
        <Teleport to={state.target}>
          <span class="tele-move">移动</span>
        </Teleport>
      )
    }
    mount('#s23b', App)
    expect(t1.querySelector('.tele-move')).not.toBeNull()

    state.target = '#tele-t2'
    await nextTick()
    expect(t1.querySelector('.tele-move')).toBeNull()
    expect(t2.querySelector('.tele-move')).not.toBeNull()
  })

  it('Transition：进入动画类（无时长立即清理，无残留）', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr">
          <Transition name="fade">
            {state.show ? <div class="tr-box">进入</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mount('#s23c', App)

    // 挂载后进入动画类已同步添加（enter-from/enter-active）
    const box = host.querySelector('.tr-box')
    expect(box).not.toBeNull()
    expect(box!.classList.contains('fade-enter-from')).toBe(true)
    expect(box!.classList.contains('fade-enter-active')).toBe(true)

    // 无过渡时长：双 rAF 后类立即清理（最终态无残留）
    await new Promise((r) => setTimeout(r, 60))
    expect(box!.classList.contains('fade-enter-from')).toBe(false)
    expect(box!.classList.contains('fade-enter-active')).toBe(false)
    expect(box!.classList.contains('fade-enter-to')).toBe(false)
    expect(box!.textContent).toBe('进入')
  })

  it('Transition：显式 duration 保留 enter-to 中间态，结束后清理', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr-d">
          <Transition name="fade" duration={300}>
            {state.show ? <div class="tr-box-d">进入</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mount('#s23d2', App)
    const box = host.querySelector('.tr-box-d')
    expect(box!.classList.contains('fade-enter-from')).toBe(true)

    // 双 rAF 后进入 enter-to 中间态（duration=300 =》 类保留）
    await new Promise((r) => setTimeout(r, 60))
    expect(box!.classList.contains('fade-enter-from')).toBe(false)
    expect(box!.classList.contains('fade-enter-to')).toBe(true)
    expect(box!.classList.contains('fade-enter-active')).toBe(true)

    // duration 结束后清理
    await new Promise((r) => setTimeout(r, 450))
    expect(box!.classList.contains('fade-enter-to')).toBe(false)
    expect(box!.classList.contains('fade-enter-active')).toBe(false)
  })

  it('Transition：子节点移除播 leave，无时长立即卸载', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr2">
          <Transition name="fade">
            {state.show ? <div class="tr-box2">内容</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mount('#s23e', App)
    expect(host.querySelector('.tr-box2')).not.toBeNull()

    state.show = false
    await nextTick()
    // 无过渡时长：双 rAF 后立即完成卸载
    await new Promise((r) => setTimeout(r, 60))
    expect(host.querySelector('.tr-box2')).toBeNull()
  })

  it('Transition：显式 duration 离开动画保留 DOM 与 leave 类，结束后卸载', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr2-d">
          <Transition name="fade" duration={300}>
            {state.show ? <div class="tr-box2-d">内容</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mount('#s23f', App)
    state.show = false
    await nextTick()

    // 动画期间：DOM 保留 + leave 中间态类
    await new Promise((r) => setTimeout(r, 60))
    const box = host.querySelector('.tr-box2-d')
    expect(box).not.toBeNull()
    expect(box!.classList.contains('fade-leave-active')).toBe(true)
    expect(box!.classList.contains('fade-leave-to')).toBe(true)

    // duration 结束后真正卸载
    await new Promise((r) => setTimeout(r, 450))
    expect(host.querySelector('.tr-box2-d')).toBeNull()
  })
})

// ------------------------------------------------------------
// 场景 24：onUnmounted / watchEffect 补导出
// ------------------------------------------------------------
describe('场景 24：onUnmounted / watchEffect', () => {
  it('onUnmounted：卸载后触发，且在 beforeUnmount 之后', async () => {
    const log: string[] = []
    const state = reactive({ show: true })
    function Child() {
      onBeforeUnmount(() => log.push('beforeUnmount'))
      onUnmounted(() => log.push('unmounted'))
      return <span>child</span>
    }
    function App() {
      return <div>{state.show ? <Child /> : null}</div>
    }
    const host = mount('#s24a', App)
    expect(host.textContent).toContain('child')

    state.show = false
    await nextTick()
    expect(host.textContent).not.toContain('child')
    expect(log).toEqual(['beforeUnmount', 'unmounted'])
  })

  it('watchEffect：立即执行 + 依赖变化异步触发 + stop 停止', async () => {
    const state = reactive({ count: 1 })
    const calls: number[] = []
    const stop = watchEffect(() => calls.push(state.count))

    expect(calls).toEqual([1]) // 立即执行一次

    state.count = 2
    await nextTick()
    expect(calls).toEqual([1, 2]) // 依赖变化异步触发

    stop()
    state.count = 3
    await nextTick()
    expect(calls).toEqual([1, 2]) // stop 后不再响应
  })

  it('watchEffect：组件内创建 =》 随组件卸载自动停止', async () => {
    const state = reactive({ n: 0 })
    const hits: number[] = []
    const state2 = reactive({ show: true })
    function Child() {
      watchEffect(() => hits.push(state.n))
      return <span>child</span>
    }
    function App() {
      return <div>{state2.show ? <Child /> : null}</div>
    }
    mount('#s24c', App)
    expect(hits).toEqual([0])

    state.n = 1
    await nextTick()
    expect(hits).toEqual([0, 1])

    // 卸载 Child =》 watchEffect 自动停止
    state2.show = false
    await nextTick()
    state.n = 2
    await nextTick()
    expect(hits).toEqual([0, 1]) // 不再增加
  })
})

// ------------------------------------------------------------
// 场景 25：图标页（SVG 展示）
// ------------------------------------------------------------
describe('场景 25：图标页（SVG）', () => {
  it('路由 /icon 渲染 SVG 图标（innerHTML 注入，SVG 命名空间正确）', async () => {
    if (!document.querySelector('#app')) {
      const h = document.createElement('div')
      h.id = 'app'
      document.body.appendChild(h)
    }
    await import('../src/main.tsx')
    const routerMod = await import('../src/router.ts')
    const appRoot = document.querySelector('#app')!

    routerMod.router.push('/icon')
    await nextTick()
    await nextTick()

    const svg = appRoot.querySelector('.icon svg')
    expect(svg).not.toBeNull()
    // innerHTML 注入 =》 SVG 命名空间（区别于 renderer createElement 的 XHTML）
    expect(svg!.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(svg!.querySelector('path')?.getAttribute('fill')).toContain('url(#')
    expect(appRoot.textContent).toContain('Vite')
  })
})

// ------------------------------------------------------------
// 场景 26：keyed diff — Fragment 根组件（keyed 列表中的组件返回 Fragment）
// ------------------------------------------------------------
describe('场景 26：keyed diff Fragment 根组件', () => {
  const Group = defineComponent((props: any) => {
    return () => (
      <>
        <div class="group-item">{props.text}</div>
      </>
    )
  })

  it('带 key 的 Fragment 根组件正常挂载（不再丢失）', () => {
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group key={0} text="G" />
        </div>
      )
    }
    const host = mount('#s26a', App)
    const item = host.querySelector('.group-item')
    expect(item).not.toBeNull()
    expect(item!.textContent).toBe('G')
    // 顺序：label 在 group-item 前
    expect(host.textContent).toContain('LG')
  })

  it('对照：去掉 key 走普通 patch 也正常', () => {
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group text="G" />
        </div>
      )
    }
    const host = mount('#s26b', App)
    expect(host.querySelector('.group-item')?.textContent).toBe('G')
  })

  it('key 交换重排：Fragment 根组件参与移动，DOM 顺序正确无重复', async () => {
    const state = reactive({ order: [0, 1, 2] })
    function App() {
      return (
        <div id="s26c">
          {state.order.map((i) => (
            <Group key={i} text={'G' + i} />
          ))}
        </div>
      )
    }
    const host = mount('#s26c', App)
    const texts = () => Array.from(host.querySelectorAll('.group-item')).map((n) => n.textContent)

    expect(texts()).toEqual(['G0', 'G1', 'G2'])

    // 交换 0 与 2
    state.order = [2, 1, 0]
    await nextTick()
    expect(texts()).toEqual(['G2', 'G1', 'G0'])

    // 增删：头部插入 + 删除尾部
    state.order = [3, 2, 1]
    await nextTick()
    expect(texts()).toEqual(['G3', 'G2', 'G1'])

    // 无重复、无丢失
    const flat = texts().join(',')
    expect(new Set(texts()).size).toBe(texts().length)
    expect(flat).toContain('G3')
    expect(flat).not.toContain('G0')
  })

  it('Fragment 根组件与普通元素混排（相邻兄弟是 Fragment 根 =》 anchor 正确）', async () => {
    const state = reactive({ flip: false })
    const A = defineComponent((_p: any) => () => (
      <>
        <i class="a1">A1</i>
        <i class="a2">A2</i>
      </>
    ))
    const B = defineComponent((_p: any) => () => (
      <>
        <b class="b1">B1</b>
      </>
    ))
    function App() {
      return (
        <div id="s26d">
          {state.flip ? <B key={1} /> : <A key={1} />}
          <span class="tail">T</span>
        </div>
      )
    }
    void 0
    const host = mount('#s26d', App)
    expect(host.textContent).toContain('A1A2T')

    state.flip = true
    await nextTick()
    // A（Fragment 双节点）被 B 替换，tail 仍在其后
    expect(host.textContent).toContain('B1T')
    expect(host.querySelector('.a1')).toBeNull()
    expect(host.querySelector('.a2')).toBeNull()
  })

  it('嵌套 keyed：Fragment 根组件内部含 keyed children 不崩溃、完整挂载', () => {
    // 回归：未命中 oldKeyToIndex 的新节点挂到 null 容器时，内层
    // patchKeyedChildren 的 insertBefore(container=null) 会 TypeError。
    // 修复：新节点直接挂到真实 container（参照 Vue），插入阶段仅调整顺序。
    const Group = defineComponent((props: any) => {
      return () => (
        <>
          {[0, 1].map((i) => (
            <span key={i} class="inner">
              G{props.text}-{i}
            </span>
          ))}
        </>
      )
    })
    function App() {
      return (
        <div>
          <span class="label">L</span>
          <Group key={0} text="A" />
          <Group key={1} text="B" />
        </div>
      )
    }
    const host = mount('#s26e', App)
    const inners = Array.from(host.querySelectorAll('.inner')).map((n) => n.textContent)
    expect(inners).toEqual(['GA-0', 'GA-1', 'GB-0', 'GB-1'])
    expect(host.querySelectorAll('.inner').length).toBe(4)
  })
})

// ------------------------------------------------------------
// 场景 27：attribute fallthrough（非 prop 属性透传到根元素）
// ------------------------------------------------------------
describe('场景 27：attribute fallthrough', () => {
  it('背景场景：外部 class 落到组件根元素（.vp-doc 生效）', () => {
    function Content(props: any) {
      return <div class="content-body">{props.children}</div>
    }
    function App() {
      return <Content class="vp-doc">内容</Content>
    }
    const host = mount('#s27a', App)
    const root = host.querySelector('.content-body')!
    expect(root.classList.contains('vp-doc')).toBe(true)
    expect(root.classList.contains('content-body')).toBe(true) // 自带 class 保留
  })

  it('class 合并：组件自带 + 外部共存', () => {
    function Panel() {
      return <section class="panel">P</section>
    }
    function App() {
      return <Panel class="extra-1 extra-2" />
    }
    const host = mount('#s27b', App)
    const sec = host.querySelector('section')!
    expect(sec.classList.contains('panel')).toBe(true)
    expect(sec.classList.contains('extra-1')).toBe(true)
    expect(sec.classList.contains('extra-2')).toBe(true)
  })

  it('显式优先：根元素已声明的属性不被外部覆盖', () => {
    function Btn(props: any) {
      return <button type="button" id="inner">{props.children}</button>
    }
    function App() {
      return <Btn type="submit" id="outer">点</Btn>
    }
    const host = mount('#s27c', App)
    const btn = host.querySelector('button')!
    expect(btn.getAttribute('type')).toBe('button') // 内部显式优先
    expect(btn.id).toBe('inner')
  })

  it('白名单透传：id 透传；title/data-x 等业务 props 不透传', () => {
    function Card() {
      return <div class="card">C</div>
    }
    function App() {
      return <Card id="card-1" title="提示" data-x="1" />
    }
    const host = mount('#s27d', App)
    const card = host.querySelector('.card')!
    expect(card.id).toBe('card-1') // 白名单内：id 透传
    expect(card.getAttribute('title')).toBeNull() // 白名单外：不透传
    expect(card.getAttribute('data-x')).toBeNull() // 白名单外：不透传
  })

  it('bug 回归：业务 props（数组/对象）不透传 =》 根元素无 features 属性', () => {
    // 全量透传时 <VPFeatures features={[...]}> 根元素带 features="[object Array]"
    function VPFeatures(props: any) {
      return <div class="VPFeatures">{props.children}</div>
    }
    function App() {
      return <VPFeatures features={[{ title: 'a' }, { title: 'b' }]}>内容</VPFeatures>
    }
    const host = mount('#s27d2', App)
    const root = host.querySelector('.VPFeatures')!
    expect(root.hasAttribute('features')).toBe(false) // 业务 prop 不透传
    expect(root.hasAttribute('title')).toBe(false)
    expect(root.className).toBe('VPFeatures')
  })

  it('style 对象合并：根 {color} + attrs {fontSize} =》 两者都在', () => {
    function Panel() {
      return <section class="panel" style={{ color: 'red' }}>P</section>
    }
    function App() {
      return <Panel style={{ fontSize: '12px' }} />
    }
    const host = mount('#s27d3', App)
    const sec = host.querySelector('section')!
    expect(sec.style.color).toBe('red') // 根自带保留
    expect(sec.style.fontSize).toBe('12px') // attrs 合并进来
  })

  it('Fragment 多根：不自动 fallthrough', () => {
    function Multi() {
      return (
        <>
          <p class="m1">1</p>
          <p class="m2">2</p>
        </>
      )
    }
    function App() {
      return <Multi class="should-not-apply" />
    }
    const host = mount('#s27e', App)
    expect(host.querySelector('.m1')!.classList.contains('should-not-apply')).toBe(false)
    expect(host.querySelector('.m2')!.classList.contains('should-not-apply')).toBe(false)
  })

  it('内置组件根（Teleport）不透传', () => {
    const target = document.createElement('div')
    target.id = 's27-target'
    document.body.appendChild(target)
    function TeleWrapper() {
      return (
        <Teleport to="#s27-target">
          <span class="tele-child">T</span>
        </Teleport>
      )
    }
    function App() {
      return <TeleWrapper class="should-not" title="no" />
    }
    mount('#s27e2', App)
    const child = target.querySelector('.tele-child')!
    expect(child.classList.contains('should-not')).toBe(false)
    expect(child.hasAttribute('title')).toBe(false)
  })

  it('更新：外部 class 变化 =》 根元素 class 更新（走 updateProps → update）', async () => {
    const state = reactive({ cls: 'a' })
    function Content() {
      return <div class="body">B</div>
    }
    function App() {
      return <Content class={state.cls} />
    }
    const host = mount('#s27f', App)
    const root = host.querySelector('.body')!
    expect(root.classList.contains('a')).toBe(true)

    state.cls = 'b'
    await nextTick()
    expect(root.classList.contains('a')).toBe(false)
    expect(root.classList.contains('b')).toBe(true)
    expect(root.classList.contains('body')).toBe(true) // 自带 class 始终保留
  })

  it('事件透传：外部 onclick 落到无事件根元素并触发', () => {
    let clicked = 0
    function Wrap(props: any) {
      return <div class="wrap">{props.children}</div>
    }
    function App() {
      return <Wrap onclick={() => clicked++}>W</Wrap>
    }
    const host = mount('#s27g', App)
    host.querySelector('.wrap')!.dispatchEvent(new Event('click'))
    expect(clicked).toBe(1)
  })

  it('排除：key / ref / children / slots 不落根元素', () => {
    let refVal: any = null
    function Item(props: any) {
      return <li class="item">{props.children}</li>
    }
    function App() {
      return <Item key="k1" ref={(el: any) => (refVal = el)}>文本</Item>
    }
    const host = mount('#s27h', App)
    const li = host.querySelector('.item')!
    expect(li.getAttribute('key')).toBeNull()
    expect(li.getAttribute('ref')).toBeNull()
    expect(li.textContent).toBe('文本') // children 正常渲染而非落属性
    expect(refVal).not.toBeNull() // ref 回调正常执行
  })
})
