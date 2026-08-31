// ============================================================
// 无头组件 render 的 VNode 实例形态（等价 cloneElement）验收
//   覆盖：复用 type + 合并 ARIA 状态 / children 覆盖语义（对齐
//         cloneElement：组件 children 覆盖 render 自带 children）/
//         Fragment VNode / 组件 VNode（收 merged props）
// 运行：pnpm exec vitest run test/headless-render-vnode.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, useRootElement } from '@actview/core'

function Headless(props: any) {
  const rootRef = useRootElement()
  // 多分支早退依赖每次渲染新鲜的 props 解构 / 用户 render 回调立即调用 →
  // 小写分发函数保持逐渲染求值；链末尾默认 <div> 是真实 JSX 分支，
  // 三元才被插件整体包进 render（新约定）
  const renderAsFunction = () => {
    const { render, orientation = 'horizontal', ...elementProps } = props
    const state = { orientation }
    const merged: any = {
      role: 'separator',
      'aria-orientation': orientation,
      ...elementProps,
    }
    return render({ ...merged, ...state, ref: rootRef })
  }
  const renderAsVNode = () => {
    // VNode 形态：复用 type + 合并 props（等价 cloneElement）；
    // key 透传；ref 不强制覆盖（用户自己的 ref 保留）
    const Tag = props.render.type as any
    return <Tag key={props.render.key} {...props.render.props} {...computeMerged()} />
  }
  const computeMerged = () => {
    const { orientation = 'horizontal', ...elementProps } = props
    return {
      role: 'separator',
      'aria-orientation': orientation,
      ...elementProps,
    } as any
  }
  return typeof props.render === 'function'
    ? renderAsFunction()
    : props.render
      ? renderAsVNode()
      : <div {...computeMerged()} />
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'vr-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('VNode 形态 render', () => {
  it('render={<span/>}：复用 type + 合并 ARIA 状态', () => {
    function App() {
      return <Headless render={<span class="sp" />} orientation="vertical" />
    }
    const host = mount(App)
    const el = host.querySelector('.sp')!
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('role')).toBe('separator')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('children 语义：merged（组件 children）覆盖 render 元素自带 children（对齐 cloneElement）', () => {
    function App() {
      return <Headless render={<span>custom</span>}>outer</Headless>
    }
    const host = mount(App)
    expect(host.querySelector('span')!.textContent).toBe('outer')
  })

  it('render 是 Fragment VNode', () => {
    function App() {
      return (
        <Headless
          render={
            <>
              <i>a</i>
              <b>b</b>
            </>
          }
        />
      )
    }
    const host = mount(App)
    expect(host.querySelector('i')!.textContent).toBe('a')
    expect(host.querySelector('b')!.textContent).toBe('b')
  })

  it('render 是组件 VNode', () => {
    function Custom(props: any) {
      return <div class="custom">{props['aria-orientation']}</div>
    }
    function App() {
      return <Headless render={<Custom />} orientation="vertical" />
    }
    const host = mount(App)
    expect(host.querySelector('.custom')!.textContent).toBe('vertical')
  })
})
