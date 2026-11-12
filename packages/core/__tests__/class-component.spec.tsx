// ============================================================
// 第一版类组件验收：
//   - @Component 强制标记 / render 校验
//   - @Ref：this.count 响应式、只重渲染自身组件
//   - @Prop：父更新 props 触发子渲染、默认值
//   - 生命周期顺序；private 字段
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Mounted,
  Prop,
  Ref,
  Setup,
  Unmounted,
  createApp,
  nextTick,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@actview/core：类组件第一版', () => {
  it('@Ref 响应式渲染 + 只重跑自身 render；@Prop 默认值/更新', async () => {
    const logs: string[] = []
    let counterRender = 0
    let rootRender = 0

    @Component({ name: 'Counter' })
    class Counter extends ActViewComponent<{ initial?: number }> {
      @Prop initial = 1
      @Ref count = 0

      @Setup
      setup(): void {
        this.count = this.initial
      }

      @Mounted
      mounted(): void {
        logs.push('counter:mounted')
      }

      @Unmounted
      unmounted(): void {
        logs.push('counter:unmounted')
      }

      render() {
        counterRender++
        return (
          <button
            onClick={() => {
              this.count++
            }}
          >
            {this.count}/{this.initial}
          </button>
        )
      }
    }

    @Component({ name: 'Root' })
    class Root extends ActViewComponent {
      @Ref initial = 2

      @Mounted
      mounted(): void {
        logs.push('root:mounted')
      }

      render() {
        rootRender++
        return (
          <div>
            <Counter initial={this.initial} />
            <span>{this.initial}</span>
          </div>
        )
      }
    }

    const root = mountRoot()
    const app = createApp(Root)
    const instance = app.mount(root) as unknown as Root
    await nextTick()

    expect(root.querySelector('button')?.textContent).toBe('2/2')
    expect(counterRender).toBe(1)
    expect(logs).toContain('counter:mounted')
    expect(logs).toContain('root:mounted')

    // @Ref：this.count++ → 自身组件重渲染
    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.querySelector('button')?.textContent).toBe('3/2')
    expect(counterRender).toBe(2)
    expect(rootRender).toBe(1) // 父组件没有重渲染

    // @Prop：父 @Ref 变化 → 子 props 更新、子 render 重跑
    instance.initial = 5
    await nextTick()
    expect(root.querySelector('button')?.textContent).toBe('3/5')
    expect(root.querySelector('span')?.textContent).toBe('5')
    expect(counterRender).toBe(3)
    expect(rootRender).toBe(2)

    app.unmount()
    await nextTick()
    expect(logs).toContain('counter:unmounted')
  })

  it('@Prop 缺省 → initializer fallback；private 字段可用', async () => {
    @Component({ name: 'WithDefault' })
    class WithDefault extends ActViewComponent<{ label?: string }> {
      @Prop label = 'fallback'
      #secret = 'ok'

      render() {
        return <div>{this.label + ':' + this.#secret}</div>
      }
    }

    const root = mountRoot()
    createApp(WithDefault).mount(root)
    await nextTick()
    expect(root.textContent).toBe('fallback:ok')
  })

  it('@Component 必须显式标记（裸 class 不作为组件）', () => {
    class Bare {
      render() {
        return null
      }
    }
    const root = mountRoot()
    expect(() => createApp(Bare as any).mount(root)).toThrow(/根组件无效/)
  })
})
