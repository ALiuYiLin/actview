// ============================================================
// @actview/core M3（第一批）验收测试（happy-dom）
//   - 错误处理：ErrorBoundary / onErrorCaptured / app.config.errorHandler
//   - async setup + Suspense（fallback → 内容）
//   - lazy 异步组件
//   - DevTools 钩子（mount / update / unmount）
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ErrorBoundary,
  Fragment,
  Suspense,
  createApp,
  defineComponent,
  getDevtoolsHook,
  lazy,
  nextTick,
  onErrorCaptured,
  setDevtoolsHook,
} from '../src/index'
import { createVNode } from '@actview/runtime-core/internal'
import type { VNode } from '@actview/runtime-core/internal'
import { ref } from '@actview/reactivity'
import type { Ref } from '@actview/reactivity'

type Props = Record<string, any> | null

function h(type: any, props: Props = null, ...children: any[]): VNode {
  const merged: Record<string, any> = { ...(props ?? {}) }
  let key: string | number | null = null
  if ('key' in merged) {
    key = merged.key as string | number
    delete merged.key
  }
  if (children.length === 1) merged.children = children[0]
  else if (children.length > 1) merged.children = children
  return createVNode(type, merged, key)
}

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

/** 多轮 flush：async setup / Suspense 的 pending 变化会跨多个微任务批次 */
async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
  setDevtoolsHook(null)
  vi.restoreAllMocks()
})

// ============================================================
// 1. 错误处理
// ============================================================
describe('@actview/core M3：错误处理', () => {
  it('ErrorBoundary：子组件渲染抛错 → 显示 fallback', async () => {
    const Boom = defineComponent(() => () => {
      throw new Error('boom')
    })
    const App = defineComponent(() => () =>
      h(
        ErrorBoundary,
        { fallback: h('span', null, 'fallback') },
        h(Boom),
      ),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    await nextTick()

    expect(root.textContent).toContain('fallback')
  })

  it('ErrorBoundary：fallback 可以是函数（收到错误）', async () => {
    const Boom = defineComponent(() => () => {
      throw new Error('kaboom')
    })
    const App = defineComponent(() => () =>
      h(
        ErrorBoundary,
        {
          fallback: (err: unknown) =>
            h('b', null, `caught:${(err as Error).message}`),
        },
        h(Boom),
      ),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    await nextTick()

    expect(root.textContent).toContain('caught:kaboom')
  })

  it('onErrorCaptured：父组件捕获子树错误', async () => {
    const captured: string[] = []
    const Boom = defineComponent(() => () => {
      throw new Error('child-error')
    })
    const Parent = defineComponent(() => {
      onErrorCaptured((err) => {
        captured.push((err as Error).message)
        return false
      })
      return () => h('div', null, h(Boom))
    })

    const root = mountRoot()
    createApp(Parent).mount(root)
    await nextTick()
    await nextTick()

    expect(captured).toContain('child-error')
  })

  it('app.config.errorHandler：无边界时交给全局处理', async () => {
    const handler = vi.fn()
    const Boom = defineComponent(() => () => {
      throw new Error('global')
    })
    const App = defineComponent(() => () => h(Boom))

    const root = mountRoot()
    const app = createApp(App)
    app.config.errorHandler = handler
    app.mount(root)
    await nextTick()

    expect(handler).toHaveBeenCalled()
    expect((handler.mock.calls[0][0] as Error).message).toBe('global')
  })
})

// ============================================================
// 2. async setup + Suspense
// ============================================================
describe('@actview/core M3：async setup + Suspense', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  it('async setup：Suspense fallback → 内容', async () => {
    const gate = deferred<string>()
    const AsyncComp = defineComponent(async () => {
      const text = await gate.promise
      return () => h('b', null, text)
    })
    const App = defineComponent(() => () =>
      h(
        Suspense,
        { fallback: h('span', null, 'loading') },
        h(AsyncComp),
      ),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    await flush()
    expect(root.textContent).toContain('loading')

    gate.resolve('loaded')
    await flush()
    expect(root.textContent).toContain('loaded')
  })

  it('lazy：loader 完成后渲染真实组件', async () => {
    const gate = deferred<void>()
    const Real = defineComponent(() => () => h('i', null, 'real'))
    const Lazy = lazy(() =>
      gate.promise.then(() => ({ default: Real })),
    )
    const App = defineComponent(() => () =>
      h(Suspense, { fallback: h('span', null, 'loading') }, h(Lazy)),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    await flush()
    expect(root.textContent).toContain('loading')

    gate.resolve()
    await flush()
    expect(root.textContent).toContain('real')
  })

  it('async setup 拒绝：交给 ErrorBoundary / 全局处理', async () => {
    const handler = vi.fn()
    const Failing = defineComponent(async () => {
      throw new Error('async-fail')
    })
    const App = defineComponent(() => () => h(Suspense, null, h(Failing)))

    const root = mountRoot()
    const app = createApp(App)
    app.config.errorHandler = handler
    app.mount(root)
    await flush()

    expect(handler).toHaveBeenCalled()
  })
})

// ============================================================
// 3. DevTools
// ============================================================
describe('@actview/core M3：DevTools 钩子', () => {
  it('mount / update / unmount 触发对应钩子', async () => {
    const log: string[] = []
    setDevtoolsHook({
      onComponentMount: (info) => log.push(`mount:${info.name}`),
      onComponentUpdate: (info) => log.push(`update:${info.name}`),
      onComponentUnmount: (info) => log.push(`unmount:${info.name}`),
    })

    let count!: Ref<number>
    const App = defineComponent(() => {
      count = ref(0)
      return () => h('div', null, String(count.value))
    }, 'App')

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)
    expect(log).toContain('mount:App')

    count.value = 1
    await nextTick()
    expect(log).toContain('update:App')

    app.unmount()
    expect(log).toContain('unmount:App')
  })

  it('未注册 hook 时零开销（不抛错）', () => {
    expect(getDevtoolsHook()).toBeNull()
    const App = defineComponent(() => () => h('div', null, 'x'))
    const root = mountRoot()
    createApp(App).mount(root)
    expect(root.textContent).toBe('x')
  })
})

