// ============================================================
// 无头组件 render 经 <component is> 统一 string/组件分支验收
//   方案 B：render = string | ComponentType | 函数
//   覆盖：render="span" / render={组件} / render 函数 / is 剥离（PD-24）
// 运行：pnpm exec vitest run test/headless-render-is.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, ref } from 'actview'

// 方案 B：render = string | ComponentType | function，string/组件用 <component is> 统一
function Headless(props: any) {
  const rootRef = ref<any>(null)
  // 多分支早退依赖每次渲染新鲜的 props 解构 / 用户 render 回调立即调用 →
  // 小写分发函数保持逐渲染求值；链结构中保留真实 JSX 分支满足插件判定（新约定）
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
      ? // string（'span'）或组件 —— <component is> 统一，is 由 PD-24 剥离
        <component is={props.render} ref={rootRef} {...computeMerged()} />
      : <div ref={rootRef} {...computeMerged()} />
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'ris-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('render 经 <component is> 统一', () => {
  it('render="span"（字符串标签）', () => {
    function App() {
      return <Headless render="span" class="sp" orientation="vertical" />
    }
    const host = mount(App)
    const el = host.querySelector('.sp')!
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('role')).toBe('separator')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('render={组件}（组件类型）', () => {
    function Custom(props: any) {
      return <div class="custom">{props['aria-orientation']}</div>
    }
    function App() {
      return <Headless render={Custom} orientation="vertical" />
    }
    const host = mount(App)
    expect(host.querySelector('.custom')!.textContent).toBe('vertical')
  })

  it('render 函数仍走单 props 对象', () => {
    function App() {
      return (
        <Headless
          orientation="vertical"
          render={(p: any) => <div class="fn">{p['aria-orientation']}</div>}
        />
      )
    }
    const host = mount(App)
    expect(host.querySelector('.fn')!.textContent).toBe('vertical')
  })

  it('目标组件 props 不含 is（PD-24）', () => {
    let captured: any = null
    function Custom(props: any) {
      captured = props
      return <div class="c2">{props.msg}</div>
    }
    function App() {
      return <Headless render={Custom} msg="hi" />
    }
    const host = mount(App)
    expect(host.querySelector('.c2')!.textContent).toBe('hi')
    expect('is' in captured).toBe(false)
  })
})
