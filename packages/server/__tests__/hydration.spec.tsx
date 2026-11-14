// ============================================================
// @actview/server Phase 3：hydration
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Prop,
  Ref,
  nextTick,
} from '@actview/core'
import { createSSRApp } from '../src/index'

function mountContainer(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@actview/server：hydrate', () => {
  it('复用服务端 DOM，绑定事件并继续更新', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      count = 0

      render() {
        return (
          <button onClick={() => this.count++}>
            count:{this.count}
          </button>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    const root = mountContainer(html)
    const originalButton = root.querySelector('button')!

    const client = createSSRApp(App)
    const instance = client.hydrate(root) as unknown as App
    await Promise.resolve()

    expect(root.querySelector('button')).toBe(originalButton)
    expect(root.textContent).toBe('count:0')

    originalButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
    await nextTick()
    expect(instance.count).toBe(1)
    expect(root.textContent).toBe('count:1')
    expect(root.querySelector('button')).toBe(originalButton)

    client.unmount()
    expect(root.innerHTML).toBe('')
  })

  it('复用文本 / 嵌套组件 / 属性', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent<{ name: string }> {
      @Prop
      name = ''

      render() {
        return <span class="child">{this.name}</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent<{ name: string }> {
      render() {
        return (
          <div>
            <h1>Hello</h1>
            <Child name={this.$props.name} />
          </div>
        )
      }
    }

    const html = await createSSRApp(App, { name: 'Ada' }).renderToString()
    const root = mountContainer(html)
    const originalH1 = root.querySelector('h1')!
    const originalSpan = root.querySelector('.child')!

    const client = createSSRApp(App, { name: 'Ada' })
    client.hydrate(root)
    await Promise.resolve()

    expect(root.querySelector('h1')).toBe(originalH1)
    expect(root.querySelector('.child')).toBe(originalSpan)
    expect(root.textContent).toBe('HelloAda')
  })
})

