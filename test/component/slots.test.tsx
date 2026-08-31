// ============================================================
// 插槽（v2 语义）：默认插槽 / 作用域插槽 / 具名插槽
//   v1 的 slot="x" template 方言与「children 是函数」形态在 v2 统一为
//   vue 插槽系统：函数 children 编译为 default slot（props.slots.default
//   调用传作用域），具名插槽用 v-slots 对象
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp } from 'actview'

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
// 场景 14：默认插槽 + 作用域插槽
// ------------------------------------------------------------
describe('场景 14：插槽与动态组件', () => {
  it('作用域插槽（函数 children → default slot，组件内调用传作用域）', () => {
    function List(props: any) {
      return (
        <ul>
          {props.items.map((item: string, i: number) => (
            <li key={item}>{props.slots.default?.({ item, i })}</li>
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
})

// ------------------------------------------------------------
// 场景 20：具名插槽
// ------------------------------------------------------------
describe('场景 20：具名插槽', () => {
  it('具名插槽 + 默认插槽分发（v-slots 对象）', () => {
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
        <Card
          v-slots={{
            header: () => '标题',
            footer: () => '页脚',
          }}
        >
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

  it('具名作用域插槽（v-slots 函数形态，参数即作用域）', () => {
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
        <List
          items={['a', 'b']}
          v-slots={{
            item: (item: string, i: number) => <b>{i}:{item}</b>,
          }}
        />
      )
    }
    const host = mount('#s20b', App)
    const ul = host.children[0] as HTMLUListElement
    expect(Array.from(ul.children).map((li) => li.textContent).join(',')).toBe('0:a,1:b')
  })

  it('默认插槽 + 具名插槽混合（v-slots）', () => {
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
        <Panel v-slots={{ title: () => 'Title!' }}>
          Body
        </Panel>
      )
    }
    const host = mount('#s20c', App)
    expect(host.children[0].textContent).toBe('Title!Body')
  })
})