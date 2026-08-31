// ============================================================
// v2 自动 defineComponent 包装（React 函数组件语义）
//   React 形态组件免手动包装——
//   @actview/plugin-jsx 编译期自动包 defineComponent
// ============================================================
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'actview'

// React 语义形态 1：函数声明 + 直接 return JSX（编译期包成 render）
function Counter(props: { step?: number }) {
  const count = ref(0)
  return (
    <button className="c" onClick={() => (count.value += props.step ?? 1)}>
      {count.value}
    </button>
  )
}

// React 语义形态 2：箭头 expression body（直接返回 JSX）
const Badge = ({ label }: { label: string }) => <span className="b">{label}</span>

// 形态 3：带 children 的组件（children 桥接）
function Card(props: { title?: string; children?: any }) {
  return (
    <div className="card" data-t={props.title}>
      {props.children}
    </div>
  )
}

// 手动 defineComponent：跳过自动包装
const Manual = defineComponent(function () {
  return <i className="m">m</i>
})

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2: 自动 defineComponent 包装', () => {
  it('三种形态 + 手动包装全部渲染，children 桥接可用', () => {
    const App = () => (
      <div>
        <Counter step={2} />
        <Badge label="b1" />
        <Card title="t">
          <span>child</span>
        </Card>
        <Manual />
      </div>
    )
    const host = mount(App)
    expect(host.querySelector('.c')).toBeTruthy()
    expect(host.querySelector('.b')?.textContent).toBe('b1')
    expect(host.querySelector('.card')?.getAttribute('data-t')).toBe('t')
    expect(host.querySelector('.card span')?.textContent).toBe('child')
    expect(host.querySelector('.m')).toBeTruthy()
  })

  it('免包装组件响应式更新 + props 读取', async () => {
    const App = () => (
      <div>
        <Counter />
      </div>
    )
    const host = mount(App)
    const btn = host.querySelector('.c') as HTMLElement
    expect(btn.textContent).toBe('0')
    btn.click()
    await nextTick()
    expect(btn.textContent).toBe('1')
  })
})
