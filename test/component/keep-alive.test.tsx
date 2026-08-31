// ============================================================
// KeepAlive 增强 + 缓存实例 / 多组件循环切换
// （拆分自 test/runtime-enhance.test.tsx "KeepAlive 增强" +
//   test/verify.test.tsx 场景 14 中两个 keep-alive it）
// 运行：pnpm exec vitest run test/component/keep-alive.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  createApp,
  reactive,
  nextTick,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  KeepAlive
} from '@actview/core'

// ---------- helpers（来自 test/runtime-enhance.test.tsx）----------
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'enh-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
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

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ============================================================
// test/runtime-enhance.test.tsx — KeepAlive 增强
// ============================================================
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

// ============================================================
// test/verify.test.tsx — 场景 14：keep-alive 两个 it
// ============================================================
describe('场景 14：插槽与动态组件', () => {
  it('keep-alive 缓存实例：切换不重建、缓存期间更新仍生效', async () => {
    const state = reactive({ view: 'a', count: 0 })
    let aMounted = 0
    function A() {
      onMounted(() => aMounted++)
      return <div>CompA({state.count})</div>
    }
    function B() {
      return <div>CompB</div>
    }
    function App() {
      return (
        <div><KeepAlive><component is={state.view === 'a' ? A : B} /></KeepAlive></div>
      )
    }
    const host = mountId('#s14c', App)
    expect(collectText(host)).toContain('CompA(0)')
    expect(aMounted).toBe(1)
    const aDiv = host.children[0].children[0] // A 的根 DOM

    state.view = 'b'
    await nextTick()
    expect(collectText(host)).toContain('CompB')
    expect(aDiv.parentNode).not.toBe(host.children[0]) // A 的 DOM 已移入隐藏容器

    state.count = 5 // 缓存期间 A 的 effect 仍响应（隐藏容器内更新）
    await nextTick()

    state.view = 'a'
    await nextTick()
    expect(collectText(host)).toContain('CompA(5)')
    expect(aMounted).toBe(1) // 不重建：onMounted 只触发一次
    expect(host.children[0].children[0]).toBe(aDiv) // DOM 复用
  })

  it('keep-alive 多组件循环切换（动态组件 key 冲突回归）', async () => {
    // 回归：<component is> 的 vnode type 是 'component'（未解析），
    // 若缓存 key 直接取 type，A/B/C 共享同一 key 互相覆盖 → 切换错乱
    const state = reactive({ tab: 'a' })
    function A() {
      return <div>CompA</div>
    }
    function B() {
      return <div>CompB</div>
    }
    function C() {
      return <div>CompC</div>
    }
    function App() {
      return (
        <KeepAlive>
          <component is={state.tab === 'a' ? A : state.tab === 'b' ? B : C} />
        </KeepAlive>
      )
    }
    const host = mountId('#s14d', App)
    const expectTab = async (tab: string, text: string) => {
      state.tab = tab
      await nextTick()
      expect(collectText(host)).toContain(text)
      expect(host.children.length).toBe(1) // 每轮只保留一个活动组件 DOM（不累积）
    }
    // 循环三组件两轮：每次都应渲染目标组件且不累积 DOM
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
    // 第三轮（回归：缓存命中复用后重新标记，否则实例被真卸载导致 replace 重建累积）
    await expectTab('b', 'CompB')
    await expectTab('c', 'CompC')
    await expectTab('a', 'CompA')
  })
})