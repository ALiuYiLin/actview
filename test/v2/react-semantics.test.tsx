// ============================================================
// v2 冒烟测试：Vue 引擎 + React 语义 JSX
// 覆盖：className/htmlFor/onChange 映射、defineComponent 桥接（children）、
//       createContext（provide/inject）、响应式更新
// ============================================================
import { describe, expect, it } from 'vitest'
import { createApp, createContext, defineComponent, nextTick, reactive, ref } from 'actview'

// ---------- React 风格组件（defineComponent 桥接） ----------

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2: React 语义 JSX on Vue', () => {
  it('className 映射 + children 桥接 + 响应式更新', async () => {
    const Card = defineComponent(function (props: { title?: string; children?: any }) {
      return (
        <div className="card" data-title={props.title ?? ''}>
          {props.children}
        </div>
      )
    }, 'Card')

    const App = defineComponent(function () {
      const count = ref(0)
      return (
        <div className="app">
          <Card title={`n=${count.value}`}>
            <button className="btn" onClick={() => count.value++}>
              +
            </button>
            <span className="num">{count.value}</span>
          </Card>
        </div>
      )
    })

    const host = mount(App)
    expect(host.querySelector('.app')).toBeTruthy()
    expect(host.querySelector('.card')?.getAttribute('data-title')).toBe('n=0')
    expect(host.querySelector('.btn')).toBeTruthy()

    host.querySelector('.btn')!.dispatchEvent(new MouseEvent('click'))
    await nextTick()
    expect(host.querySelector('.num')?.textContent).toBe('1')
    expect(host.querySelector('.card')?.getAttribute('data-title')).toBe('n=1')
  })

  it('onChange → onInput：输入事件触发更新', async () => {
    const App = defineComponent(function () {
      const text = ref('')
      return (
        <input
          className="field"
          value={text.value}
          onChange={(e: any) => {
            text.value = e.target.value
          }}
        />
      )
    })

    const host = mount(App)
    const input = host.querySelector('.field') as HTMLInputElement
    input.value = 'abc'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect((host.querySelector('.field') as HTMLInputElement).value).toBe('abc')
  })

  it('createContext：Provider + use() 注入', async () => {
    const ThemeCtx = createContext(reactive({ color: 'red' }))

    const Themed = defineComponent(function () {
      const theme = ThemeCtx.use()
      return <span className="themed" style={{ color: theme.color }} />
    })

    const App = defineComponent(function () {
      return (
        <ThemeCtx.Provider value={reactive({ color: 'blue' })}>
          <Themed />
        </ThemeCtx.Provider>
      )
    })

    const host = mount(App)
    expect(host.querySelector('.themed')?.getAttribute('style')).toContain('blue')
  })

  it('htmlFor 映射', () => {
    const App = defineComponent(function () {
      return (
        <div>
          <label htmlFor="inp">L</label>
          <input id="inp" />
        </div>
      )
    })
    const host = mount(App)
    expect(host.querySelector('label')?.getAttribute('for')).toBe('inp')
  })

  it('v-model 语法（Vue 原生指令）在 JSX 中可用', async () => {
    const App = defineComponent(function () {
      const text = ref('hi')
      return (
        <div>
          <input v-model={text.value} className="vm" />
          <span className="show">{text.value}</span>
        </div>
      )
    })
    const host = mount(App)
    const input = host.querySelector('.vm') as HTMLInputElement
    input.value = 'changed'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(host.querySelector('.show')?.textContent).toBe('changed')
  })
})
