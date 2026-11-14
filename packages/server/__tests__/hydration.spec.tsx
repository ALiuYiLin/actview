// ============================================================
// @actview/server Phase 3：hydration
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActViewComponent,
  Component,
  KeepAlive,
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

  it('基础 mismatch：替换不匹配的根元素', async () => {
    @Component({ name: 'ServerApp' })
    class ServerApp extends ActViewComponent {
      render() {
        return <span>server</span>
      }
    }

    @Component({ name: 'ClientApp' })
    class ClientApp extends ActViewComponent {
      render() {
        return <div>client</div>
      }
    }

    const html = await createSSRApp(ServerApp).renderToString()
    const root = mountContainer(html)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const client = createSSRApp(ClientApp)
      client.hydrate(root)
      await Promise.resolve()
      expect(root.innerHTML).toBe('<div>client</div>')
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('hydration 绑定 ref 回调', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      el: HTMLElement | null = null

      render() {
        return (
          <div
            ref={(el: Element | null) => {
              this.el = el as HTMLElement | null
            }}
          >
            ref
          </div>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    const root = mountContainer(html)
    const original = root.querySelector('div')!

    const client = createSSRApp(App)
    const instance = client.hydrate(root) as unknown as App
    await Promise.resolve()

    expect(instance.el).toBe(original)
  })

  it('KeepAlive 子树可以 hydrate', async () => {
    @Component({ name: 'Inner' })
    class Inner extends ActViewComponent {
      render() {
        return <span>keep</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <KeepAlive>
            <Inner />
          </KeepAlive>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    const root = mountContainer(html)
    const original = root.querySelector('span')!

    const client = createSSRApp(App)
    client.hydrate(root)
    await nextTick()

    expect(root.querySelector('span')).toBe(original)
    expect(root.textContent).toBe('keep')
  })
})

