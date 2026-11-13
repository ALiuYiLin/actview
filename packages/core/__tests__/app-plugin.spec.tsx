// ============================================================
// App 插件契约：
//   - app.use(plugin, options) 同步安装 / 幂等 / 链式；
//   - plugin 可以 app.provide / config / onUnmount；
//   - app.config 默认 devtools=__DEV__、performance=false；
//   - mount 之后禁止安装插件。
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActViewComponent,
  Component,
  Inject,
  createApp,
  type AppPlugin,
  type Plugin,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('@actview/core：App 插件契约', () => {
  it('app.use 幂等、链式、传递 options，并可 app.provide', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Inject('message')
      message!: string

      render() {
        return <span>{this.message}</span>
      }
    }

    const install = vi.fn(
      (app: any, options?: { message: string }) => {
        app.provide('message', options?.message ?? 'default')
      },
    )
    const plugin: AppPlugin<{ message: string }> = {
      name: 'test-plugin',
      install,
    }

    const app = createApp(App)
    expect(app.use(plugin, { message: 'ok' })).toBe(app)
    expect(app.use(plugin, { message: 'ignored' })).toBe(app)
    expect(install).toHaveBeenCalledTimes(1)

    const root = mountRoot()
    app.mount(root)
    await Promise.resolve()
    expect(root.textContent).toBe('ok')
  })

  it('函数插件 + config 默认值 + onUnmount 清理一次', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <span>app</span>
      }
    }

    const app = createApp(App)
    expect(app.config.devtools).toBe(true)
    expect(app.config.performance).toBe(false)

    const seen: number[] = []
    const plugin: Plugin<{ value: number }> = (instance, options) => {
      seen.push(options?.value ?? -1)
      instance.onUnmount(() => {
        seen.push(99)
      })
    }

    app.use(plugin, { value: 7 })
    const root = mountRoot()
    app.mount(root)
    expect(seen).toEqual([7])

    app.unmount()
    expect(seen).toEqual([7, 99])
    app.unmount()
    expect(seen).toEqual([7, 99])
  })

  it('mount 之后调用 app.use 报错', () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <span>app</span>
      }
    }

    const app = createApp(App)
    const root = mountRoot()
    app.mount(root)

    expect(() => {
      app.use({ install() {} })
    }).toThrow(/mount\(\) 之前/)
  })

  it('插件 install 抛错后可重试（失败的插件不进入已安装集合）', () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <span>app</span>
      }
    }

    const app = createApp(App)
    let attempts = 0
    const plugin: AppPlugin = {
      install() {
        attempts++
        throw new Error('boom')
      },
    }

    expect(() => app.use(plugin)).toThrow(/boom/)
    expect(() => app.use(plugin)).toThrow(/boom/)
    expect(attempts).toBe(2)
  })
})
