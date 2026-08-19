// ============================================================
// 生命周期钩子（拆分自 test/runtime-enhance.test.tsx "生命周期补全" +
//   test/verify.test.tsx 场景 12 + 场景 24 onUnmounted）
// 运行：pnpm exec vitest run test/component/lifecycle.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  createApp,
  reactive,
  nextTick,
  onBeforeMount,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onErrorCaptured,
  onServerPrefetch,
  onRenderTracked,
  onRenderTriggered,
  renderToString,
  defineComponent
} from 'actview'

// ---------- helpers（来自 test/runtime-enhance.test.tsx）----------
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'life-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ---------- helpers（来自 test/verify.test.tsx，因 mount 签名不同而重命名）----------
/** 创建带容器 id 的宿主元素并挂载组件（来自 verify.test.tsx） */
function mountId(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

// ============================================================
// test/runtime-enhance.test.tsx — 生命周期补全
// ============================================================
describe('生命周期补全', () => {
  it('onBeforeMount 在 onMounted 之前触发', () => {
    const order: string[] = []
    function App() {
      onBeforeMount(() => order.push('beforeMount'))
      onMounted(() => order.push('mounted'))
      return <div class="x">ok</div>
    }
    mount(App)
    expect(order).toEqual(['beforeMount', 'mounted'])
  })

  it('onErrorCaptured 捕获子组件渲染错误，返回 false 停止传播', () => {
    let captured: any = null
    const Bad = defineComponent(function () {
      return () => {
        throw new Error('boom')
      }
    })
    function Parent() {
      onErrorCaptured((err) => {
        captured = err
        return false
      })
      return <Bad />
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount(Parent)
    expect(captured).toBeInstanceOf(Error)
    expect((captured as Error).message).toBe('boom')
    spy.mockRestore()
  })

  it('onRenderTracked / onRenderTriggered 调试钩子', async () => {
    const tracked: string[] = []
    const triggered: string[] = []
    const state = reactive({ n: 0 })
    function App() {
      onRenderTracked((e: any) => tracked.push(String(e.key)))
      onRenderTriggered((e: any) => triggered.push(String(e.key)))
      return <div>{state.n}</div>
    }
    mount(App)
    expect(tracked.length).toBeGreaterThan(0) // 首次渲染收集依赖
    state.n = 1
    await nextTick()
    expect(triggered).toContain('n')
  })

  it('onServerPrefetch 在 renderToString 阶段执行', () => {
    let prefetched = false
    function App() {
      onServerPrefetch(() => {
        prefetched = true
      })
      return <div>hi</div>
    }
    renderToString(<App />)
    expect(prefetched).toBe(true)
  })
})

// ============================================================
// test/verify.test.tsx — 场景 12：生命周期钩子
// ============================================================
describe('场景 12：生命周期钩子', () => {
  it('onMounted / onUpdated / onBeforeUnmount 按时序触发', async () => {
    const log: string[] = []
    const state = reactive({ show: true, count: 0 })
    function Child() {
      onMounted(() => log.push('mounted'))
      onUpdated(() => log.push('updated'))
      onBeforeUnmount(() => log.push('beforeUnmount'))
      return <span>{state.count}</span>
    }
    function App() {
      return <div>{state.show ? <Child /> : null}</div>
    }
    const host = mountId('#s12', App)

    expect(log).toEqual(['mounted']) // 首次挂载只触发 mounted

    state.count = 1
    await nextTick()
    expect(log).toEqual(['mounted', 'updated']) // 状态变化触发 updated

    state.show = false // 卸载 Child
    await nextTick()
    expect(log).toEqual(['mounted', 'updated', 'beforeUnmount'])
  })

  it('onUpdated 钩子里改「父组件渲染依赖」的响应式不无限循环（pauseTracking 回归）', async () => {
    // 反模式场景：钩子执行期间框架暂停依赖收集（对齐 Vue 3 post 队列语义）。
    // 若不停 track，`counts.updated++` 的「读」会把它 track 进 Child 渲染 effect，
    // 写时触发自身 => 无限循环崩溃。
    const state = reactive({ n: 0 })
    const counts = reactive({ updated: 0 })
    let childRuns = 0
    let pageRuns = 0
    function Child() {
      onUpdated(() => counts.updated++)
      return <span>{(childRuns++, state.n)}</span>
    }
    function App() {
      return <div>{(pageRuns++, 'upd:' + counts.updated)}
        <Child />
      </div>
    }
    const host = mountId('#s12b', App)
    expect(counts.updated).toBe(0)

    state.n++
    await nextTick()
    await nextTick()

    // Child 只渲染一次（state.n 触发），Page 因 counts.updated 变化重渲染一次
    expect(childRuns).toBe(2)
    expect(pageRuns).toBe(2)
    expect(counts.updated).toBe(1) // 不循环：updated 恰好 1 次
    expect(host.textContent).toContain('upd:1')
  })
})

// ============================================================
// test/verify.test.tsx — 场景 24：onUnmounted
// ============================================================
describe('场景 24：onUnmounted / watchEffect', () => {
  it('onUnmounted：卸载后触发，且在 beforeUnmount 之后', async () => {
    const log: string[] = []
    const state = reactive({ show: true })
    function Child() {
      onBeforeUnmount(() => log.push('beforeUnmount'))
      onUnmounted(() => log.push('unmounted'))
      return <span>child</span>
    }
    function App() {
      return <div>{state.show ? <Child /> : null}</div>
    }
    const host = mountId('#s24a', App)
    expect(host.textContent).toContain('child')

    state.show = false
    await nextTick()
    expect(host.textContent).not.toContain('child')
    expect(log).toEqual(['beforeUnmount', 'unmounted'])
  })
})