import { testComponent } from './test-helper'
// ============================================================
// @actview/core M3b 验收测试（happy-dom）
//   - Teleport：children 渲染到目标容器 / 更新 / 卸载
//   - KeepAlive：实例缓存（setup 不重跑）/ activated / deactivated /
//     include 过滤
//   - Transition：enter / leave 类名 + 延迟卸载
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  KeepAlive,
  Teleport,
  Transition,
  createApp,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
} from '../src/index'
import { createVNode } from '@actview/runtime-core/internal'
import type { VNode } from '@actview/runtime-core/internal'
import { ref } from '@actview/reactivity'
import type { Ref } from '@actview/reactivity'

type Props = Record<string, any> | null

function h(type: any, props: Props = null, ...children: any[]): VNode {
  const merged: Record<string, any> = { ...(props ?? {}) }
  let key: string | null = null
  if ('key' in merged) {
    key = merged.key as string
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  document.body.innerHTML = ''
})

// ============================================================
// 1. Teleport
// ============================================================
describe('@actview/core M3b：Teleport', () => {
  it('children 渲染到目标容器；更新同步；卸载清理目标', async () => {
    const target = document.createElement('div')
    target.id = 'teleport-target'
    document.body.appendChild(target)

    let text!: Ref<string>
    const App = testComponent(() => {
      text = ref('one')
      return () =>
        h(
          'div',
          null,
          h(Teleport, { to: '#teleport-target' }, h('span', null, text.value)),
        )
    })

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)

    expect(root.querySelector('span')).toBeNull() // 不在原容器
    expect(target.querySelector('span')?.textContent).toBe('one')

    text.value = 'two'
    await nextTick()
    expect(target.querySelector('span')?.textContent).toBe('two')

    app.unmount()
    expect(target.innerHTML).toBe('')
  })

  it('to 可以是 Element', () => {
    const target = document.createElement('section')
    document.body.appendChild(target)
    const App = testComponent(() => () =>
      h(Teleport, { to: target }, h('b', null, 'x')),
    )
    const root = mountRoot()
    createApp(App).mount(root)
    expect(target.querySelector('b')?.textContent).toBe('x')
  })
})

// ============================================================
// 2. KeepAlive
// ============================================================
describe('@actview/core M3b：KeepAlive', () => {
  it('切换组件保留实例（setup 不重跑）+ activated/deactivated', async () => {
    let which!: Ref<'a' | 'b'>
    const logs: string[] = []
    let aSetup = 0
    let bSetup = 0

    const A = testComponent(() => {
      aSetup++
      onMounted(() => logs.push('A-mounted'))
      onActivated(() => logs.push('A-activated'))
      onDeactivated(() => logs.push('A-deactivated'))
      onUnmounted(() => logs.push('A-unmounted'))
      return () => h('i', null, 'A')
    }, 'A')

    const B = testComponent(() => {
      bSetup++
      onMounted(() => logs.push('B-mounted'))
      onActivated(() => logs.push('B-activated'))
      onDeactivated(() => logs.push('B-deactivated'))
      return () => h('i', null, 'B')
    }, 'B')

    const App = testComponent(() => {
      which = ref('a')
      return () =>
        h(KeepAlive, null, which.value === 'a' ? h(A) : h(B))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(root.textContent).toBe('A')
    expect(aSetup).toBe(1)

    which.value = 'b'
    await nextTick()
    expect(root.textContent).toBe('B')
    expect(bSetup).toBe(1)
    expect(logs).toContain('A-deactivated')

    which.value = 'a'
    await nextTick()
    expect(root.textContent).toBe('A')
    expect(aSetup).toBe(1) // 实例复用
    expect(logs).toContain('A-activated')
    expect(logs).toContain('B-deactivated')
  })

  it('include 未命中 → 不缓存（正常卸载）', async () => {
    let which!: Ref<'a' | 'b'>
    const logs: string[] = []

    const A = testComponent(() => () => h('i', null, 'A'), 'A')
    const B = testComponent(() => {
      onUnmounted(() => logs.push('B-unmounted'))
      return () => h('i', null, 'B')
    }, 'B')

    const App = testComponent(() => {
      which = ref('a')
      return () =>
        h(KeepAlive, { include: 'A' }, which.value === 'a' ? h(A) : h(B))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()

    which.value = 'b'
    await nextTick()
    expect(root.textContent).toBe('B')
    // 切回 a：B 未被缓存 → 真正卸载
    which.value = 'a'
    await nextTick()
    expect(logs).toContain('B-unmounted')
  })
})

// ============================================================
// 3. Transition
// ============================================================
describe('@actview/core M3b：Transition', () => {
  it('enter 类名添加后按时长清理', async () => {
    const App = testComponent(() => () =>
      h(Transition, { name: 'fade', duration: 20 }, h('div', null, 'x')),
    )
    const root = mountRoot()
    createApp(App).mount(root)
    const el = root.querySelector('div')!

    expect(el.classList.contains('fade-enter-from')).toBe(true)
    expect(el.classList.contains('fade-enter-active')).toBe(true)

    await sleep(60)
    expect(el.classList.contains('fade-enter-from')).toBe(false)
    expect(el.classList.contains('fade-enter-active')).toBe(false)
  })

  it('leave：卸载时先播 leave 类，时长后移除 DOM', async () => {
    const App = testComponent(() => () =>
      h(Transition, { name: 'fade', duration: 20 }, h('div', null, 'x')),
    )
    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)
    const el = root.querySelector('div')!
    await sleep(60)

    app.unmount()
    expect(root.querySelector('div')).toBe(el)
    expect(el.classList.contains('fade-leave-from')).toBe(true)

    await sleep(80)
    expect(root.querySelector('div')).toBeNull()
  })
})
