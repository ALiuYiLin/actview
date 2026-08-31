// ============================================================
// 无头组件 Separator（Base UI React → ActView 转换）验收
//   覆盖：默认 div + ARIA 状态 / render VNode 实例换标签 /
//         render 函数完全重实现（收单 props 对象）/ props 响应式更新
// 运行：pnpm exec vitest run test/headless-separator.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, useRootElement } from '@actview/core'

export const Separator = defineComponent(function (componentProps: any) {
  // ref 契约恒为根 DOM：useRootElement 封装 subTree.el 推导 + 生命周期同步
  // （组件 VNode 时也指向组件根 DOM 而非实例；实例用 getCurrentInstance）
  const rootRef = useRootElement()

  return () => {
    const { render, orientation = 'horizontal', ...elementProps } = componentProps

    const state = { orientation }

    const merged: any = {
      role: 'separator',
      'aria-orientation': orientation,
      ...elementProps,
    }

    if (render) {
      if (typeof render === 'function') {
        // render prop：单 props 对象（元素 props + state + ref 全合并）
        return render({ ...merged, ...state, ref: rootRef })
      }
      // VNode 实例：复用 type + 合并 props（等价 cloneElement）。
      // key 透传（VNode.key 在字段不在 props）；merged 覆盖 render.props；
      // ref 不强制覆盖——用户自己的 ref 保留，rootRef 由 subTree.el 推导
      const Tag = render.type as any
      return <Tag key={render.key} {...render.props} {...merged} />
    }
    return <div {...merged} />
  }
})

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'sep-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('Separator 转换验证', () => {
  it('默认渲染 div + ARIA 状态', () => {
    function App() {
      return <Separator orientation="vertical" class="sep-a" />
    }
    const host = mount(App)
    const el = host.querySelector('.sep-a')!
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('role')).toBe('separator')
    expect(el.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('render={<span/>}（VNode 实例）换标签', () => {
    function App() {
      return <Separator render={<span class="sep-b" />} />
    }
    const host = mount(App)
    const el = host.querySelector('.sep-b')!
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('role')).toBe('separator')
  })

  it('render 函数完全重实现（收到 props + state + ref）', () => {
    function App() {
      return (
        <Separator
          orientation="vertical"
          render={(props: any) => (
            <div {...props} class="my-sep">
              {props['aria-orientation'] === 'vertical' ? '竖' : '横'}
            </div>
          )}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.my-sep')!
    expect(el.textContent).toBe('竖')
    expect(el.getAttribute('role')).toBe('separator')
  })

  it('orientation prop 变化 → 响应式更新', async () => {
    const state = reactive({ o: 'horizontal' })
    function App() {
      return (
        <div>
          <Separator orientation={state.o} class="sep-d" />
          <button class="toggle" onClick={() => (state.o = 'vertical')} />
        </div>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.sep-d')!.getAttribute('aria-orientation')).toBe('horizontal')
    ;(host.querySelector('.toggle') as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.sep-d')!.getAttribute('aria-orientation')).toBe('vertical')
  })
})
