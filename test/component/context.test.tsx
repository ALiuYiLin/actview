// ============================================================
// createContext — 存值语义（store-as-is）验收
//   <Ctx.Provider value>（经典）/ <Ctx value>（React 19 风格）/ ctx.use()
//   契约：provide 原样存储,不包 ref/不 watch——响应式由传入的
//         reactive 对象 / 装ref容器 / rawRef 携带,消费端读取即收集依赖。
//   覆盖：提供值/默认值 / 响应式传播（reactive 通道）/ ref 通道（rawRef）/
//         对象携带 ref / 就近覆盖 / 键隔离 / React 19 风格 / SSR
// 运行：pnpm exec vitest run test/component/context.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, createContext, rawRef, reactive, ref, renderToString } from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'ctx-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('createContext（store-as-is）', () => {
  it('Provider 提供值 / 无 Provider 回退默认值', () => {
    const ThemeCtx = createContext('default')
    function Consumer() {
      const theme = ThemeCtx.use()
      return <span class="v">{theme}</span>
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

  it('响应式通道①：传 reactive 对象（引用稳定）→ 深层属性更新直达消费方', async () => {
    const ThemeCtx = createContext<{ theme: string } | undefined>(undefined)
    const state = reactive({ theme: 'light' })
    function Consumer() {
      const s = ThemeCtx.use()!
      return <span class="v">{s.theme}</span>
    }
    function App() {
      return (
        <ThemeCtx.Provider value={state}>
          <Consumer />
        </ThemeCtx.Provider>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('light')

    state.theme = 'dark'
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('dark')
  })

  it('响应式通道②：对象携带 ref（顶层解包豁免——容器原样入表）', async () => {
    const CountCtx = createContext<{ count: ReturnType<typeof ref<number>> } | undefined>(undefined)
    const count = ref(0)
    function Consumer() {
      const bag = CountCtx.use()!
      return <span class="v">{bag.count.value}</span>
    }
    function App() {
      // 顶层解包只处理「值本身就是 ref」的属性;装进对象的 ref 原样入表
      return <CountCtx.Provider value={{ count }}><Consumer /></CountCtx.Provider>
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('0')

    count.value = 7
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('7')
  })

  it('响应式通道③：rawRef 直传 ref 本体 → 消费端 .value 活读', async () => {
    const CountCtx = createContext<ReturnType<typeof ref<number>> | undefined>(undefined)
    const count = ref(0)
    function Consumer() {
      const r = CountCtx.use()!
      return <span class="v">{r.value}</span>
    }
    function App() {
      // rawRef:绕过 jsxFactory 顶层解包,ref 本体直达注入表
      return <CountCtx.Provider value={rawRef(count)}><Consumer /></CountCtx.Provider>
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('0')

    count.value = 7
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('7')
  })

  it('就近覆盖：内层 Provider 胜出，且各自响应式互不影响', async () => {
    const LangCtx = createContext<{ lang: string } | undefined>(undefined)
    const state = reactive({ lang: 'zh' })
    function Consumer() {
      const s = LangCtx.use()!
      return <span class="v">{s.lang}</span>
    }
    function App() {
      return (
        <LangCtx.Provider value={{ lang: 'en' }}>
          <>
            <div>
              <LangCtx.Provider value={state}>
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

    state.lang = 'ja'
    await flush()
    expect(vals()).toEqual(['ja', 'en'])
  })

  it('键隔离：两个上下文同值互不污染（对象身份即键）', () => {
    const A = createContext('a-default')
    const B = createContext('b-default')
    function ShowBoth() {
      const a = A.use()
      const b = B.use()
      return (
        <span>
          <i class="a">{a}</i>
          <i class="b">{b}</i>
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

  it('React 19 风格：<Ctx value={reactive}> 直接作组件', async () => {
    const UserCtx = createContext<{ name: string } | undefined>(undefined)
    const state = reactive({ name: 'alice' })
    function Consumer() {
      const s = UserCtx.use()!
      return <span class="v">{s.name}</span>
    }
    function App() {
      return (
        <UserCtx value={state}>
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
      return <span class="v">{theme}</span>
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
