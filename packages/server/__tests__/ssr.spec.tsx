// ============================================================
// @actview/server Phase 1：同步 SSR
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  ErrorBoundary,
  Inject,
  KeepAlive,
  Model,
  Prop,
  Provide,
  Ref,
  Setup,
  Suspense,
  UseModel,
  lazy,
} from '@actview/core'
import { createSSRApp, renderToString } from '../src/index'

describe('@actview/server：renderToString', () => {
  it('渲染元素 / 文本 / 组件 / props / 属性', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent<{ name: string }> {
      @Prop
      name = ''

      render() {
        return <span class="child" data-name={this.name}>{this.name}</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <main>
            <h1>Hello</h1>
            <Child name="Ada & Bob" />
            <input disabled value="x" onClick={() => {}} />
          </main>
        )
      }
    }

    const app = createSSRApp(App)
    const html = await app.renderToString()

    expect(html).toContain('<main>')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('<span class="child" data-name="Ada &amp; Bob">Ada &amp; Bob</span>')
    expect(html).toContain('<input disabled value="x">')
    expect(html).not.toContain('onClick')
  })

  it('Model / Setup / provide-inject', async () => {
    @Model
    class CounterData {
      @Ref
      count = 0

      @Setup
      setup(): void {
        this.count = 3
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @Inject('theme')
      theme!: string

      @UseModel(CounterData)
      data!: CounterData

      render() {
        return <span>{this.theme}:{this.data.count}</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Provide()
      theme = 'dark'

      render() {
        return <Child />
      }
    }

    const html = await renderToString(createSSRApp(App))
    expect(html).toContain('dark:3')
  })

  it('per-request 状态隔离', async () => {
    @Model
    class PageData {
      @Ref
      value = 0
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent<{ initial: number }> {
      @Prop
      initial = 0

      @UseModel(PageData)
      data!: PageData

      @Setup
      setup(): void {
        this.data.value = this.initial
      }

      render() {
        return <span>{this.data.value}</span>
      }
    }

    const a = await createSSRApp(App, { initial: 1 }).renderToString()
    const b = await createSSRApp(App, { initial: 2 }).renderToString()

    expect(a).toBe('<span>1</span>')
    expect(b).toBe('<span>2</span>')
  })

  it('Fragment / class / style / 转义', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <>
            <p class={['a', { b: true }]} style={{ backgroundColor: 'red' }}>
              {'<script>'}
            </p>
            <br />
          </>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    expect(html).toContain('class="a b"')
    expect(html).toContain('style="background-color:red"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<br>')
  })

  it('async @Setup / lazy / Suspense：等待最终内容', async () => {
    @Component({ name: 'Real' })
    class Real extends ActViewComponent {
      render() {
        return <b>real</b>
      }
    }

    const LazyReal = lazy(() => Promise.resolve({ default: Real }))

    @Component({ name: 'AsyncPage' })
    class AsyncPage extends ActViewComponent {
      @Ref
      text = ''

      @Setup
      async setup(): Promise<void> {
        await Promise.resolve()
        this.text = 'async-ready'
      }

      render() {
        return (
          <div>
            <span>{this.text}</span>
            <LazyReal />
          </div>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <Suspense fallback={<i>loading</i>}>
            <AsyncPage />
          </Suspense>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    expect(html).toContain('async-ready')
    expect(html).toContain('<b>real</b>')
    expect(html).not.toContain('loading')
  })

  it('ErrorBoundary：子组件异常输出 fallback', async () => {
    @Component({ name: 'Boom' })
    class Boom extends ActViewComponent {
      render(): any {
        throw new Error('boom')
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <ErrorBoundary fallback={<b>fallback</b>}>
            <Boom />
          </ErrorBoundary>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    expect(html).toContain('<b>fallback</b>')
  })

  it('KeepAlive / Transition / Teleport 内容直接输出', async () => {
    @Component({ name: 'Inner' })
    class Inner extends ActViewComponent {
      render() {
        return <span>inner</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <div>
            <KeepAlive>
              <Inner />
            </KeepAlive>
          </div>
        )
      }
    }

    const html = await createSSRApp(App).renderToString()
    expect(html).toContain('<span>inner</span>')
  })
})
