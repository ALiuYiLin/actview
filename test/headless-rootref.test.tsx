// ============================================================
// 无头组件 ref 契约验收：rootRef = subTree.el 推导 → ref 恒为根 DOM
//   （组件 VNode 时也指向组件根 DOM 而非实例；实例用 getCurrentInstance）
//   覆盖：render 函数返回原生元素 / 返回组件（关键）/ VNode 实例 / 默认元素
// 运行：pnpm exec vitest run test/headless-rootref.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, useRootElement } from '@actview/core'

// 方案：rootRef 由 useRootElement 推导（subTree.el + 生命周期同步）→
// 无论默认元素 / VNode 元素 / 组件 VNode，ref 恒为根 DOM
function Headless(props: any) {
  const rootRef = useRootElement()

  // 多分支早退依赖每次渲染新鲜的 props 解构 / 用户 render 回调立即调用 →
  // 小写分发函数保持逐渲染求值；链末尾默认 <div> 是真实 JSX 分支，
  // 三元才被插件整体包进 render（新约定）。rootRef 在 setup 期创建一次。
  const renderAsFunction = () => {
    const { render } = props
    return render({ ...computeMerged(), ref: rootRef })
  }
  const renderAsVNode = () => {
    const { render } = props
    const Tag = render.type as any
    // key 透传：VNode.key 在字段不在 props，{...render.props} 带不过去
    return <Tag key={render.key} {...render.props} {...computeMerged()} />
  }
  const computeMerged = () => {
    const { render, ...elementProps } = props
    return { role: 'separator', ...elementProps } as any
  }
  return typeof props.render === 'function'
    ? renderAsFunction()
    : props.render
      ? renderAsVNode()
      : <div {...computeMerged()} />
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 're-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('rootRef = subTree.el（ref 契约恒为 DOM）', () => {
  it('render 函数返回原生元素：rootRef 是该元素 DOM', () => {
    let got: any = null
    function App() {
      return (
        <Headless
          class="d1"
          render={(p: any) => {
            got = p.ref
            return <div {...p} class="user-div" />
          }}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.user-div')!
    expect(el.tagName).toBe('DIV')
    expect(got.value).toBe(el) // 用户展开 {...p} 时 ref 落到自己的元素上
  })

  it('render 函数返回组件：rootRef 指向组件根 DOM（关键）', () => {
    let got: any = null
    function Custom(props: any) {
      return <div class="custom-root">{props.msg}</div>
    }
    function App() {
      return (
        <Headless
          msg="hi"
          render={(p: any) => {
            got = p.ref
            return <Custom {...p} />
          }}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.custom-root')!
    expect(el.textContent).toBe('hi')
    // 组件 VNode 的 subTree.el → Custom 的根 DOM（不是实例）
    expect(got.value).toBe(el)
    expect(got.value?.tagName).toBe('DIV')
  })

  it('render 是 VNode 实例（<Custom/>）：rootRef 同样指向根 DOM', () => {
    let got: any = null
    function Custom(props: any) {
      return <section class="sec-root">{props.msg}</section>
    }
    function App() {
      return (
        <Headless
          msg="x"
          render={(p: any) => {
            got = p.ref
            return <Custom {...p} />
          }}
        />
      )
    }
    const host = mount(App)
    expect(host.querySelector('.sec-root')!.textContent).toBe('x')
    expect(got.value?.tagName).toBe('SECTION')
  })

  it('默认元素：rootRef 是根 div DOM', () => {
    let got: any = null
    function App() {
      return (
        <Headless
          class="d2"
          render={(p: any) => {
            got = p.ref
            return null
          }}
        />
      )
    }
    const host = mount(App)
    expect(got.value).toBe(host.querySelector('.d2'))
  })
})
