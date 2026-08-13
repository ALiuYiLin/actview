// ============================================================
// 组件运行时增强验收测试（vitest + happy-dom）
//   覆盖：生命周期补全（onBeforeMount/onActivated/onDeactivated/
//   onErrorCaptured/onServerPrefetch/onRenderTracked/onRenderTriggered）、
//   KeepAlive（include/exclude/max）、Transition（mode/appear/JS 钩子）、
//   TransitionGroup（删除动画）、Suspense（异步 setup/嵌套）
// 运行：pnpm test
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  createApp,
  reactive,
  nextTick,
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  onErrorCaptured,
  onServerPrefetch,
  onRenderTracked,
  onRenderTriggered,
  renderToString,
  KeepAlive,
  Transition,
  TransitionGroup,
  Suspense,
  defineComponent
} from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'enh-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 1. 生命周期补全
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 2. KeepAlive：include / exclude / max / activated / deactivated
// ------------------------------------------------------------
describe('KeepAlive 增强', () => {
  it('onActivated / onDeactivated 在缓存切换时触发', async () => {
    const state = reactive({ cur: 'A' })
    const log: string[] = []
    function CompA() {
      onActivated(() => log.push('A-activated'))
      onDeactivated(() => log.push('A-deactivated'))
      return <div class="a">A</div>
    }
    function CompB() {
      return <div class="b">B</div>
    }
    function App() {
      return (
        <KeepAlive>
          {state.cur === 'A' ? <CompA key="a" /> : <CompB key="b" />}
        </KeepAlive>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.a')).not.toBeNull()

    state.cur = 'B'
    await nextTick()
    expect(log).toContain('A-deactivated')

    state.cur = 'A'
    await nextTick()
    expect(log).toContain('A-activated')
  })

  it('include：命中的组件才缓存', async () => {
    const state = reactive({ cur: 'A' })
    let aUnmount = 0
    function CompA() {
      onBeforeUnmount(() => aUnmount++)
      return <div class="a">A</div>
    }
    function CompB() {
      return <div class="b">B</div>
    }
    function App() {
      return (
        <KeepAlive include="CompB">
          {state.cur === 'A' ? <CompA key="a" /> : <CompB key="b" />}
        </KeepAlive>
      )
    }
    const host = mount(App)
    state.cur = 'B'
    await nextTick()
    // CompA 不在 include，被真正卸载（unmounted 触发）
    expect(aUnmount).toBe(1)
  })

  it('max：超出上限 LRU 淘汰最旧缓存', async () => {
    const state = reactive({ cur: 'A' })
    const log: string[] = []
    let aMounts = 0
    function CompA() {
      onMounted(() => aMounts++)
      return <div class="a">A</div>
    }
    function CompB() {
      onActivated(() => log.push('B-on'))
      return <div class="b">B</div>
    }
    function CompC() {
      return <div class="c">C</div>
    }
    function App() {
      return (
        <KeepAlive max={1}>
          {state.cur === 'A' ? (
            <CompA key="a" />
          ) : state.cur === 'B' ? (
            <CompB key="b" />
          ) : (
            <CompC key="c" />
          )}
        </KeepAlive>
      )
    }
    mount(App) // A 首次挂载
    state.cur = 'B'
    await nextTick() // A 缓存，B 首次挂载
    state.cur = 'C'
    await nextTick() // B 缓存，max=1 淘汰 A，C 首次挂载
    state.cur = 'B'
    await nextTick() // B 从缓存恢复 → activated
    expect(log).toContain('B-on')
    state.cur = 'A'
    await nextTick() // A 已被淘汰 → 重新挂载（不是缓存恢复）
    expect(aMounts).toBe(2)
  })
})

// ------------------------------------------------------------
// 3. Transition：appear / mode / JS 钩子
// ------------------------------------------------------------
describe('Transition 增强', () => {
  it('默认不播放 enter，appear 才播放', () => {
    function App() {
      return (
        <Transition name="fade">
          <div class="box">x</div>
        </Transition>
      )
    }
    const host = mount(App)
    const box = host.querySelector('.box')!
    expect(box.classList.contains('fade-enter-from')).toBe(false)
  })

  it('appear 播放 enter 动画类', () => {
    function App() {
      return (
        <Transition name="fade" appear>
          <div class="box">x</div>
        </Transition>
      )
    }
    const host = mount(App)
    const box = host.querySelector('.box')!
    expect(box.classList.contains('fade-enter-from')).toBe(true)
  })

  it('mode="out-in"：旧节点离开完成后再进入新节点', async () => {
    const state = reactive({ on: true })
    function App() {
      return (
        <Transition name="fade" mode="out-in">
          {state.on ? <div class="a">A</div> : <div class="b">B</div>}
        </Transition>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.a')).not.toBeNull()

    state.on = false
    await nextTick()
    // 无过渡时长：双 rAF 后完成（等待足够时长让 rAF 回调执行）
    await new Promise((r) => setTimeout(r, 100))
    expect(host.querySelector('.a')).toBeNull()
    expect(host.querySelector('.b')).not.toBeNull()
  })

  it('JS 钩子：onEnter(el, done) 与 onAfterEnter', () => {
    const order: string[] = []
    function App() {
      return (
        <Transition
          appear
          onBeforeEnter={() => order.push('before')}
          onEnter={(_el: any, done: any) => {
            order.push('enter')
            done()
          }}
          onAfterEnter={() => order.push('after')}
        >
          <div class="box">x</div>
        </Transition>
      )
    }
    mount(App)
    expect(order).toEqual(['before', 'enter', 'after'])
  })
})

// ------------------------------------------------------------
// 4. TransitionGroup：列表删除动画
// ------------------------------------------------------------
describe('TransitionGroup', () => {
  it('列表项删除播放 leave 后延迟移除', async () => {
    const state = reactive({ items: ['a', 'b'] })
    function App() {
      return (
        <TransitionGroup name="list">
          {state.items.map((it) => (
            <div key={it} class={`item-${it}`}>
              {it}
            </div>
          ))}
        </TransitionGroup>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.item-a')).not.toBeNull()
    expect(host.querySelector('.item-b')).not.toBeNull()

    state.items = ['a'] // 删除 b
    await nextTick()
    // 无过渡时长：leave 双 rAF 后完成移除（等待足够时长）
    await new Promise((r) => setTimeout(r, 100))
    expect(host.querySelector('.item-a')).not.toBeNull()
    expect(host.querySelector('.item-b')).toBeNull()
  })
})

// ------------------------------------------------------------
// 5. Suspense：异步 setup / 嵌套
// ------------------------------------------------------------
describe('Suspense 增强', () => {
  it('异步 setup（返回 Promise<render>）配合 Suspense', async () => {
    const Async = defineComponent(async function () {
      await Promise.resolve()
      return () => <div class="async">async content</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="loading">loading</div>}>
          <Async />
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(collectText(host)).toContain('async content')
  })

  it('嵌套 Suspense 独立 fallback', async () => {
    const Inner = defineComponent(async function () {
      await Promise.resolve()
      return () => <div class="inner">inner</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="outer-loading">outer</div>}>
          <div class="outer-wrap">
            <Suspense fallback={<div class="inner-loading">inner-loading</div>}>
              <Inner />
            </Suspense>
          </div>
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(host.querySelector('.inner')).not.toBeNull()
  })
})
