// ============================================================
// Transition / TransitionGroup 动画类管理
// （拆分自 test/runtime-enhance.test.tsx "Transition 增强" / "TransitionGroup" +
//   test/verify.test.tsx 场景 23 中 4 个 Transition it）
// 运行：pnpm exec vitest run test/component/transition.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, nextTick, Transition, TransitionGroup } from 'actview'

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
// test/runtime-enhance.test.tsx — Transition 增强
// ============================================================
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

// ============================================================
// test/runtime-enhance.test.tsx — TransitionGroup
// ============================================================
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

// ============================================================
// test/verify.test.tsx — 场景 23：Transition 4 个 it
// ============================================================
describe('场景 23：Teleport / Transition', () => {
  it('Transition：进入动画类（无时长立即清理，无残留）', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr">
          <Transition name="fade" appear>
            {state.show ? <div class="tr-box">进入</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mountId('#s23c', App)

    // 挂载后进入动画类已同步添加（enter-from/enter-active）
    const box = host.querySelector('.tr-box')
    expect(box).not.toBeNull()
    expect(box!.classList.contains('fade-enter-from')).toBe(true)
    expect(box!.classList.contains('fade-enter-active')).toBe(true)

    // 无过渡时长：双 rAF 后类立即清理（最终态无残留）
    await new Promise((r) => setTimeout(r, 60))
    expect(box!.classList.contains('fade-enter-from')).toBe(false)
    expect(box!.classList.contains('fade-enter-active')).toBe(false)
    expect(box!.classList.contains('fade-enter-to')).toBe(false)
    expect(box!.textContent).toBe('进入')
  })

  it('Transition：显式 duration 保留 enter-to 中间态，结束后清理', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr-d">
          <Transition name="fade" duration={300} appear>
            {state.show ? <div class="tr-box-d">进入</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mountId('#s23d2', App)
    const box = host.querySelector('.tr-box-d')
    expect(box!.classList.contains('fade-enter-from')).toBe(true)

    // 双 rAF 后进入 enter-to 中间态（duration=300 => 类保留）
    await new Promise((r) => setTimeout(r, 60))
    expect(box!.classList.contains('fade-enter-from')).toBe(false)
    expect(box!.classList.contains('fade-enter-to')).toBe(true)
    expect(box!.classList.contains('fade-enter-active')).toBe(true)

    // duration 结束后清理
    await new Promise((r) => setTimeout(r, 450))
    expect(box!.classList.contains('fade-enter-to')).toBe(false)
    expect(box!.classList.contains('fade-enter-active')).toBe(false)
  })

  it('Transition：子节点移除播 leave，无时长立即卸载', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr2">
          <Transition name="fade">
            {state.show ? <div class="tr-box2">内容</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mountId('#s23e', App)
    expect(host.querySelector('.tr-box2')).not.toBeNull()

    state.show = false
    await nextTick()
    // 无过渡时长：双 rAF 后立即完成卸载
    await new Promise((r) => setTimeout(r, 60))
    expect(host.querySelector('.tr-box2')).toBeNull()
  })

  it('Transition：显式 duration 离开动画保留 DOM 与 leave 类，结束后卸载', async () => {
    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-tr2-d">
          <Transition name="fade" duration={300}>
            {state.show ? <div class="tr-box2-d">内容</div> : null}
          </Transition>
        </div>
      )
    }
    const host = mountId('#s23f', App)
    state.show = false
    await nextTick()

    // 动画期间：DOM 保留 + leave 中间态类
    await new Promise((r) => setTimeout(r, 60))
    const box = host.querySelector('.tr-box2-d')
    expect(box).not.toBeNull()
    expect(box!.classList.contains('fade-leave-active')).toBe(true)
    expect(box!.classList.contains('fade-leave-to')).toBe(true)

    // duration 结束后真正卸载
    await new Promise((r) => setTimeout(r, 450))
    expect(host.querySelector('.tr-box2-d')).toBeNull()
  })
})