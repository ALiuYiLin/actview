// ============================================================
// 插槽：默认插槽 / 作用域插槽 / 具名插槽（拆分自 test/verify.test.tsx 场景 14 与 20）
// 运行：pnpm exec vitest run test/component/slots.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp } from '@actview/core'

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
})

// ------------------------------------------------------------
// 场景 20：具名插槽
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
          {/* babel 插槽方言：slot="item" 是具名插槽声明，item/i 是作用域参数名（非 JSX 属性） */}
          {/* @ts-expect-error 插槽方言：slot="item" 不是标准 JSX 属性 */}
          <template slot="item" item i>
            {/* @ts-expect-error 插槽方言：item/i 是作用域参数声明，JSX 作用域无此变量 */}
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