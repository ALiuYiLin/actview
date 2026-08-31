// ============================================================
// v2 编译期 props 提取 + 自动落根（inheritAttrs）
//
//   带类型注解的组件 → @actview/plugin-jsx 编译期把第一参类型注解
//   降级为 Vue 运行时 props 声明（defineComponent(fn, { props })) →
//   actview 桥接按「有声明」开启 inheritAttrs →
//   未消费的 attrs（class / data-* / 事件 / 透传属性）自动落到根元素。
// ============================================================
import { describe, expect, it } from 'vitest'
import { createApp } from 'actview'

// 类型注解组件：step 被声明 → 消费；未声明属性 → 透传落根
function Widget(props: { step?: number }) {
  return () => <button className="w">{props.step ?? 1}</button>
}

// children 在类型里：编译期剔除（slots 桥接键），不落根、桥接正常
function Panel(props: { title?: string; children?: any }) {
  return () => (
    <div className="p" data-t={props.title}>
      {props.title}
      {props.children}
    </div>
  )
}

// interface 引用类型：同文件声明可解析
interface CardProps {
  title?: string
}
const Card = (props: CardProps) => (
  <section className="card">{props.title}</section>
)

// 默认值参数形态（props = {}）：类型注解在 left 上
function WithDefault(props: { count?: number } = { count: 0 }) {
  return () => <b className="d">{props.count ?? 1}</b>
}

// any 注解：类型不可提取 → 无 props 声明 → 维持不透传（inheritAttrs false）
function Plain(props: any) {
  return () => <i className="pl">{props.step ?? 1}</i>
}

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2: 编译期 props 提取 + 自动落根', () => {
  it('声明 props 被消费；未声明 attrs 自动落根到根元素', () => {
    const App = () => (
      <Widget step={2} {...({ 'data-x': '1' } as any)} />
    )
    const host = mount(App)
    const btn = host.querySelector('.w') as HTMLElement
    expect(btn.textContent).toBe('2')
    // 透传落根 ✓
    expect(btn.getAttribute('data-x')).toBe('1')
    // 声明过的 props 被消费，不进 DOM ✓
    expect(btn.hasAttribute('step')).toBe(false)
  })

  it('children 声明被剔除：不落根、slot 桥接正常', () => {
    const App = () => (
      <Panel title="T">
        <span>kid</span>
      </Panel>
    )
    const host = mount(App)
    const panel = host.querySelector('.p') as HTMLElement
    expect(panel.textContent).toBe('Tkid')
    expect(panel.hasAttribute('children')).toBe(false)
  })

  it('interface 引用类型：同样提取 + 透传（scoped data-v 落根）', () => {
    const App = () => (
      <Card title="C" {...({ 'data-v-abc': '1' } as any)} />
    )
    const host = mount(App)
    const card = host.querySelector('.card') as HTMLElement
    expect(card.textContent).toBe('C')
    expect(card.getAttribute('data-v-abc')).toBe('1')
  })

  it('默认值参数形态（props = {}）也能提取', () => {
    const App = () => <WithDefault count={5} />
    const host = mount(App)
    expect(host.querySelector('.d')?.textContent).toBe('5')
  })

  it('any 注解（无法提取）：维持不透传语义', () => {
    const App = () => <Plain {...({ 'data-y': '1' } as any)} />
    const host = mount(App)
    const el = host.querySelector('.pl') as HTMLElement
    expect(el.hasAttribute('data-y')).toBe(false)
  })
})
