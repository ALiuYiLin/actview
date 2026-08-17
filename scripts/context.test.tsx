// ============================================================
// createContext — React 风格上下文（验收测试）
//   <Ctx.Provider value>（经典）/ <Ctx value>（React 19 风格）/ ctx.use()
//   覆盖：提供值/默认值 / 响应式（value 变化消费方自动重渲染）/
//         就近覆盖 / 键隔离 / SSR
// 运行：pnpm vitest run scripts/context.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, createContext, reactive, renderToString } from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'ctx-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('createContext', () => {
  it('Provider 提供值 / 无 Provider 回退默认值', () => {
    const ThemeCtx = createContext('default')
    function Consumer() {
      const theme = ThemeCtx.use()
      return <span class="v">{theme.value}</span>
    }
    function App() {
      return (
        <div>
          <ThemeCtx.Provider value="dark">
            <Consumer />
          </ThemeCtx.Provider>
          <Consumer />
        </div>
      )
    }
    const host = mount(App)
    const vals = Array.from(host.querySelectorAll('.v')).map((n) => n.textContent)
    expect(vals).toEqual(['dark', 'default'])
  })

  it('响应式：Provider value 变化 → 消费方自动重渲染（React 语义）', async () => {
    const ThemeCtx = createContext('default')
    const state = reactive({ theme: 'light' })
    function Consumer() {
      const theme = ThemeCtx.use()
      return <span class="v">{theme.value}</span>
    }
    function App() {
      return (
        <ThemeCtx.Provider value={state.theme}>
          <Consumer />
        </ThemeCtx.Provider>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('light')

    state.theme = 'dark'
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('dark') // 消费方 effect 被触发，未重新挂载
  })

  it('就近覆盖：内层 Provider 胜出，且各自响应式互不影响', async () => {
    const LangCtx = createContext('en')
    const state = reactive({ inner: 'zh' })
    function Consumer() {
      const lang = LangCtx.use()
      return <span class="v">{lang.value}</span>
    }
    function App() {
      return (
        <LangCtx.Provider value="en">
          <>
            <div>
              <LangCtx.Provider value={state.inner}>
                <Consumer />
              </LangCtx.Provider>
            </div>
            <Consumer />
          </>
        </LangCtx.Provider>
      )
    }
    const host = mount(App)
    const vals = () => Array.from(host.querySelectorAll('.v')).map((n) => n.textContent)
    expect(vals()).toEqual(['zh', 'en'])

    state.inner = 'ja'
    await flush()
    expect(vals()).toEqual(['ja', 'en']) // 内层更新，外层不受影响
  })

  it('键隔离：两个上下文同值互不污染（对象身份即键）', () => {
    const A = createContext('a-default')
    const B = createContext('b-default')
    function ShowBoth() {
      const a = A.use()
      const b = B.use()
      return (
        <span>
          <i class="a">{a.value}</i>
          <i class="b">{b.value}</i>
        </span>
      )
    }
    function App() {
      return (
        <A.Provider value="a-val">
          <B.Provider value="b-val">
            <ShowBoth />
          </B.Provider>
        </A.Provider>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.a')!.textContent).toBe('a-val')
    expect(host.querySelector('.b')!.textContent).toBe('b-val')
  })

  it('React 19 风格：<Ctx value={v}> 直接作组件', async () => {
    const UserCtx = createContext('anon')
    const state = reactive({ name: 'alice' })
    function Consumer() {
      const user = UserCtx.use()
      return <span class="v">{user.value}</span>
    }
    function App() {
      return (
        <UserCtx value={state.name}>
          <Consumer />
        </UserCtx>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('alice')
    state.name = 'bob'
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('bob')
  })

  it('SSR：renderToString 序列化 Provider 内消费值', () => {
    const ThemeCtx = createContext('default')
    function Consumer() {
      const theme = ThemeCtx.use()
      return <span class="v">{theme.value}</span>
    }
    function App() {
      return (
        <ThemeCtx.Provider value="dark">
          <Consumer />
        </ThemeCtx.Provider>
      )
    }
    const html = renderToString(<App />)
    expect(html).toContain('dark')
  })
})
