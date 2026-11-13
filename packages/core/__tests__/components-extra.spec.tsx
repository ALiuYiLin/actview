// ============================================================
// 异步组件 / TransitionGroup / Dynamic 验收
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActViewComponent,
  Component,
  Dynamic,
  Ref,
  TransitionGroup,
  createApp,
  lazy,
  nextTick,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await nextTick()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('@actview/core：lazy options', () => {
  it('loading / error 本地 fallback + 成功渲染', async () => {
    let release!: (value: any) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })

    @Component({ name: 'Real' })
    class Real extends ActViewComponent {
      render() {
        return <b>real</b>
      }
    }

    const Lazy = lazy(() => gate, {
      loading: () => <span>loading</span>,
      error: (err) => <i>{String((err as Error).message)}</i>,
    })

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Lazy />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await flush()
    expect(root.textContent).toBe('loading')

    release({ default: Real })
    await flush()
    expect(root.textContent).toBe('real')
  })

  it('retry：失败后重试，最终成功', async () => {
    let calls = 0
    @Component({ name: 'Real' })
    class Real extends ActViewComponent {
      render() {
        return <b>ok</b>
      }
    }

    const Lazy = lazy(
      () => {
        calls++
        return calls < 3
          ? Promise.reject(new Error('fail'))
          : Promise.resolve({ default: Real })
      },
      { retry: 2 },
    )

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Lazy />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await flush()
    await sleep(20)
    await flush()
    expect(calls).toBe(3)
    expect(root.textContent).toBe('ok')
  })

  it('timeout：超时进入 error fallback', async () => {
    const Lazy = lazy(
      () => new Promise(() => {}),
      {
        timeout: 10,
        error: (err) => <span>{(err as Error).message}</span>,
      },
    )

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Lazy />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await sleep(30)
    await flush()
    expect(root.textContent).toContain('timeout')
  })
})

describe('@actview/core：TransitionGroup', () => {
  it('列表项移除：leave 类名延迟卸载', async () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      items = ['a', 'b']

      render() {
        return (
          <TransitionGroup name="fade" duration={20}>
            {this.items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </TransitionGroup>
        )
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await flush()
    expect(root.textContent).toBe('ab')

    instance.items = ['b']
    await nextTick()

    const leaving = root.querySelector('span')
    expect(leaving?.textContent).toBe('a')
    expect(leaving?.classList.contains('fade-leave-active')).toBe(true)

    await sleep(60)
    expect(root.textContent).toBe('b')
  })
})

describe('@actview/core：Dynamic', () => {
  it('is 切换组件', async () => {
    @Component({ name: 'A' })
    class A extends ActViewComponent {
      render() {
        return <span>A</span>
      }
    }

    @Component({ name: 'B' })
    class B extends ActViewComponent {
      render() {
        return <span>B</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      current: any = A

      render() {
        return <Dynamic is={this.current} />
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await flush()
    expect(root.textContent).toBe('A')

    instance.current = B
    await nextTick()
    expect(root.textContent).toBe('B')
  })
})
