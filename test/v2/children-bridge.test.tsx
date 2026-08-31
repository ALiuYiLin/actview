// ============================================================
// v2.1 children 桥接（React 对齐）+ createVNode 包装
//   ① 渲染期 props.children = slots.default() 求值（值语义）
//   ② 非渲染期读取 → undefined + 一次性提示（不执行、无警告）
//   ③ createVNode 包装：<p {...props}>（props 含 children 键）→ 抽进三参
//   ④ JSX 显式 children 优先（第三参非 null 不抽）
//   ⑤ 桥接虚拟键（children/slots）不参与展开/遍历
//   ⑥ 判断有无子内容：props.slots.default != null（静态，任何时机）
// ============================================================
import { describe, expect, it, vi } from 'vitest'
import { createApp, createVNode, createContext } from 'actview'

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2.1: children 桥接（React 对齐）', () => {
  it('渲染期 props.children = 子内容值', () => {
    function Panel(props: any) {
      return <div class="panel">{props.children}</div>
    }
    const host = mount(
      () => (
        <Panel>
          <b>kid</b>
        </Panel>
      ),
    )
    expect(host.querySelector('.panel b')?.textContent).toBe('kid')
  })

  it('非渲染期读取 props.children → undefined + 一次性提示', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let captured: any
    function Panel(props: any) {
      // setup 期（非渲染期）读取——不执行、返回 undefined、提示一次
      captured = props.children
      return <div class="panel">{props.children}</div>
    }
    mount(() => (
      <Panel>
        <b>kid</b>
      </Panel>
    ))
    expect(captured).toBeUndefined()
    // 提示只出现一次（同组件多次读取去重）
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('非渲染期读取 props.children')
    warnSpy.mockRestore()
  })

  it('判断有无子内容：props.slots.default != null（静态检查）', () => {
    function Panel(props: any) {
      const has = props.slots?.default != null
      return (
        <div class="panel" data-has={String(has)}>
          {props.children}
        </div>
      )
    }
    const withKid = mount(() => (
      <Panel>
        <i>kid</i>
      </Panel>
    ))
    const withoutKid = mount(() => <Panel />)
    expect(withKid.querySelector('.panel')?.getAttribute('data-has')).toBe('true')
    expect(withoutKid.querySelector('.panel')?.getAttribute('data-has')).toBe('false')
  })

  it('props.children 作为组件 children（惰性插槽化）→ 插槽求值期仍为渲染期', () => {
    // 组件 JSX children 被插件转成惰性插槽对象 { default: () => [...] }，
    // 读取点（本组件 props.children）在【组件子树渲染时】才执行——本组件
    // 自身 render 早已结束（词法标记失效），须靠插槽求值深度判定渲染期
    const Ctx = createContext<string | undefined>(undefined)
    function Outer(props: any) {
      return <Ctx.Provider value="v">{props.children}</Ctx.Provider>
    }
    const host = mount(() => (
      <Outer>
        <b>lazy-kid</b>
      </Outer>
    ))
    expect(host.querySelector('b')?.textContent).toBe('lazy-kid')
  })

  it('单子元素解包（React 对齐）：props.children 是元素本身而非数组', () => {
    let captured: any
    function Panel(props: any) {
      // 渲染期捕获（JSX 表达式里赋值——逗号表达式）
      return (
        <div class="panel">
          {(captured = props.children, props.children)}
        </div>
      )
    }
    const host = mount(() => (
      <Panel>
        <b>kid</b>
      </Panel>
    ))
    // React 语义：单子元素 = 元素本身（vue 插槽返回数组，桥接解包）
    expect(Array.isArray(captured)).toBe(false)
    expect(captured?.__v_isVNode).toBe(true)
    expect(host.querySelector('.panel b')?.textContent).toBe('kid')
  })
})

describe('v2.1: createVNode 包装（props.children → 第三参）', () => {
  it('<p {...props}> 展开 children 键 → 抽进第三参渲染', () => {
    const props = { id: 'x', children: <b>spread-kid</b> }
    const host = mount(() => <p {...props} />)
    const p = host.querySelector('p') as HTMLElement
    expect(p.getAttribute('id')).toBe('x')
    expect(p.querySelector('b')?.textContent).toBe('spread-kid')
  })

  it('JSX 显式 children 优先：第三参非 null 不抽 props.children', () => {
    const props = { children: <b>spread-kid</b> }
    const host = mount(
      () => (
        <p {...props}>jsx-kid</p>
      ),
    )
    const p = host.querySelector('p') as HTMLElement
    expect(p.textContent).toBe('jsx-kid')
  })

  it('组件展开 props（children 值）→ 子组件 slots.default 拿到', () => {
    function Inner(props: any) {
      return <div class="inner">{props.slots.default?.()}</div>
    }
    const props = { title: 't', children: <b>kid</b> }
    const host = mount(() => <Inner {...props} />)
    const inner = host.querySelector('.inner') as HTMLElement
    expect(inner.getAttribute('title')).toBeNull() // title 不是声明 prop → attrs（不透传）
    expect(inner.querySelector('b')?.textContent).toBe('kid')
  })

  it('直接调用 createVNode：props.children 抽第三参', () => {
    const vnode = createVNode('div', { children: 'text' })
    const host = document.createElement('div')
    createApp({ render: () => vnode }).mount(host)
    expect(host.querySelector('div')?.textContent).toBe('text')
  })
})

describe('v2.1: 桥接虚拟键不参与展开/遍历', () => {
  it('{...props} 展开不含 children/slots 键', () => {
    let captured: any
    function Panel(props: any) {
      captured = { ...props }
      return <div class="panel">{props.children}</div>
    }
    mount(() => (
      <Panel title="t">
        <b>kid</b>
      </Panel>
    ))
    expect(captured.title).toBe('t')
    expect('children' in captured).toBe(false)
    expect('slots' in captured).toBe(false)
  })

  it('Object.keys(props) 不含桥接键，props.slots 读取照常', () => {
    let keys: string[] = []
    let slotsRef: any = null
    function Panel(props: any) {
      keys = Object.keys(props)
      slotsRef = props.slots
      return <div class="panel">{props.children}</div>
    }
    mount(() => (
      <Panel title="t">
        <b>kid</b>
      </Panel>
    ))
    expect(keys).toEqual(['title'])
    expect(slotsRef).toBeTruthy()
    expect(typeof slotsRef.default).toBe('function')
  })
})
