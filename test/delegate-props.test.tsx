// ============================================================
// 薄委托组件 props 透传验收（Input → FieldControl 模式）
//   createElement(FC, componentProps) 内部 { ...config } 材料化新 props
//   对象（非代理透传）→ 每次渲染新快照 → isSameProps 值比较正常 → 委托更新
//   覆盖：createElement 直传 / 展开副本 / children 透传
// 运行：pnpm exec vitest run test/delegate-props.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createElement } from '@actview/jsx'
import { createApp, defineComponent, reactive } from '@actview/core'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'dl-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

function FieldControl(props: any) {
  return (
    <span class="fc">
      {props.msg}|{props.children}
    </span>
  )
}

describe('薄委托 props 透传', () => {
  it('createElement(FC, componentProps) 直传代理：材料化快照，更新透传', async () => {
    const state = reactive({ msg: 'a' })
    function Input(props: any) {
      // createElement 内部 { ...config } → 全新 props 对象（非代理引用）；
      // 仍走 createElement 保持被测 API。裸调用不是插件合法形态 → 用 Fragment
      // 载体包进 render 逐渲染求值（Fragment 无 DOM 实体，子树语义不变）（新约定）
      return <>{createElement(FieldControl, props)}</>
    }
    function App() {
      return <Input msg={state.msg}>kid</Input>
    }
    const host = mount(App)
    expect(host.querySelector('.fc')!.textContent).toBe('a|kid')
    state.msg = 'b'
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.fc')!.textContent).toBe('b|kid') // children 也透传
  })

  it('createElement(FC, { ...componentProps }) 显式展开：同样正确', async () => {
    const state = reactive({ msg: 'a' })
    function Input(props: any) {
      // 同上：createElement 保持被测 API，Fragment 载体包进 render（新约定）
      return <>{createElement(FieldControl, { ...props })}</>
    }
    function App() {
      return <Input msg={state.msg} />
    }
    const host = mount(App)
    expect(host.querySelector('.fc')!.textContent).toBe('a|')
    state.msg = 'b'
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.fc')!.textContent).toBe('b|')
  })
})
