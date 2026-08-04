// ============================================================
// actview 框架回归测试（vitest + happy-dom）
//   场景 1-9 + 冒烟，原 scripts/verify.mjs（DOM stub）迁移而来
// 运行：pnpm test
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw } from 'actview'
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
  it('reactive 状态变化自动重跑 patch 更新 DOM', () => {
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
    expect(collectText(host)).toContain('hello: 42')
    expect((host.children[0].children[1] as HTMLInputElement).value).toBe('42')
  })
})

// ------------------------------------------------------------
// 场景 2：keyed diff
// ------------------------------------------------------------
describe('场景 2：keyed diff', () => {
  it('按 key 复用 / 重排 / 增删', () => {
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

    state.items = ['c', 'a', 'b']
    expect(texts()).toEqual(['c', 'a', 'b'])

    state.items = ['a', 'd']
    expect(texts()).toEqual(['a', 'd'])

    state.items = ['x', 'a', 'd']
    expect(texts()).toEqual(['x', 'a', 'd'])
  })
})

// ------------------------------------------------------------
// 场景 3：props 细粒度更新
// ------------------------------------------------------------
describe('场景 3：props 细粒度更新', () => {
  it('setup 只执行一次，props 更新不重挂', () => {
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
    expect(span.textContent).toBe('world')
    expect(childSetupCount).toBe(1)
    expect(host.children[0].children[0]).toBe(span) // DOM 复用
  })
})

// ------------------------------------------------------------
// 场景 4：依赖隔离
// ------------------------------------------------------------
describe('场景 4：依赖隔离', () => {
  it('子组件内部状态变化不连带父组件重渲染', () => {
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
    expect(collectText(host)).toContain('local: changed')
    expect(parentRenderCount).toBe(1)

    parentState.msg = 'hello2!'
    expect(collectText(host)).toContain('prop: hello2!')
    expect(parentRenderCount).toBe(2)

    // 核心：props 更新路径之后，子内部状态再变化不得连带父组件
    innerState.local = 'again'
    expect(collectText(host)).toContain('local: again')
    expect(parentRenderCount).toBe(2)
  })
})

// ------------------------------------------------------------
// 场景 5：路由（RouterView 组件切换）
// ------------------------------------------------------------
describe('场景 5：路由', () => {
  it('RouterView 切换 / 动态参数 / back / link', () => {
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
    expect(collectText(host)).toContain('About page')

    router.push('/user/42')
    expect(collectText(host)).toContain('User: 42')

    router.back()
    expect(collectText(host)).toContain('About page')

    const nav = host.children[0].children[0] as HTMLElement
    ;(nav.children[0] as any).onclick({ preventDefault() {} })
    expect(collectText(host)).toContain('Home page')
    expect((nav.children[0] as HTMLAnchorElement).getAttribute('href')).toBe('/')
  })
})

// ------------------------------------------------------------
// 场景 6：数组方法响应
// ------------------------------------------------------------
describe('场景 6：数组方法', () => {
  it('push/pop/splice/reverse/索引赋值触发更新', () => {
    const state = reactive({ items: ['a', 'b', 'c'] })
    function ArrApp() {
      return <ul>{state.items.map((item) => <li key={item}>{item}</li>)}</ul>
    }
    const host = mount('#s6', ArrApp)
    const ul = host.children[0] as HTMLUListElement
    const texts = () => Array.from(ul.children).map((li) => li.textContent)

    state.items.push('d')
    expect(texts()).toEqual(['a', 'b', 'c', 'd'])

    state.items.pop()
    expect(texts()).toEqual(['a', 'b', 'c'])

    state.items.splice(1, 1)
    expect(texts()).toEqual(['a', 'c'])

    state.items.reverse()
    expect(texts()).toEqual(['c', 'a'])

    state.items[0] = 'x'
    expect(texts()).toEqual(['x', 'a'])
  })
})

// ------------------------------------------------------------
// 场景 7：for...in / in 响应
// ------------------------------------------------------------
describe('场景 7：for...in / in 响应', () => {
  it('增删 key 触发遍历与 in 检查更新', () => {
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
    expect(getText('keys')).toBe('a,b,c')

    delete (keysState as any).b
    expect(getText('keys')).toBe('a,c')
    expect(getText('has-b')).toBe('no-b')
  })
})

// ------------------------------------------------------------
// 场景 8：markRaw / readonly / shallowReactive / 非普通对象
// ------------------------------------------------------------
describe('场景 8：markRaw / readonly / shallowReactive', () => {
  it('Date 不崩溃、markRaw 隔离、readonly 拦截、shallow 浅层', () => {
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
    expect(getText('normal')).toBe('2') // 普通嵌套响应

    rawMarkedObj.n = 2
    expect(getText('marked')).toBe('1') // markRaw 不响应

    sh.nested.deep = 2
    expect(getText('sh-nested')).toBe('1') // shallow 深层不响应

    sh.top = 2
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
  it('聚焦时赋值后恢复光标，未聚焦不干预', () => {
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
    expect(inputEl.value).toBe('aXc')
    expect(inputEl.selectionStart).toBe(1)

    // 未聚焦：value 更新但光标不被恢复逻辑干预（happy-dom 与真实浏览器一致：
    // 赋值后光标重置，此处为末尾 4；关键是未被还原成记录值 2）
    ;(document.activeElement as HTMLElement)?.blur()
    inputEl.value = 'aXc'
    inputEl.setSelectionRange(2, 2)
    state.text = 'abXc'
    expect(inputEl.value).toBe('abXc')
    expect(inputEl.selectionStart).not.toBe(2)
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
    expect(collectText(appRoot)).toContain('count =')

    routerMod.router.push('/list')
    expect(collectText(appRoot)).toContain('Apple')
  })
})
