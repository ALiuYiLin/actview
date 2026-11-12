import { testComponent } from './test-helper'
// ============================================================
// 细节债验收（M3 边界）：
//   - Teleport 跨树锚点：多 Teleport 同 target 顺序 / 兄弟节点顺序 /
//     to 切换 / 卸载清理
//   - KeepAlive 多根（Fragment children）：缓存恢复 / 销毁
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  Fragment,
  KeepAlive,
  Teleport,
  createApp,
  nextTick,
  onActivated,
} from '../src/index'
import { createVNode } from '@actview/runtime-core/internal'
import type { VNode } from '@actview/runtime-core/internal'
import { ref } from '@actview/reactivity'
import type { Ref } from '@actview/reactivity'

type Props = Record<string, any> | null

function h(type: any, props: Props = null, ...children: any[]): VNode {
  const merged: Record<string, any> = { ...(props ?? {}) }
  if (children.length === 1) merged.children = children[0]
  else if (children.length > 1) merged.children = children
  return createVNode(type, merged)
}

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

// ============================================================
// Teleport 跨树锚点
// ============================================================
describe('@actview/core 细节债：Teleport 跨树锚点', () => {
  it('多个 Teleport 指向同一 target：内容顺序稳定', async () => {
    const target = document.createElement('div')
    target.id = 't'
    document.body.appendChild(target)

    let text!: Ref<string>
    let showSecond!: Ref<boolean>
    const App = testComponent(() => {
      text = ref('A')
      showSecond = ref(true)
      return () =>
        h(
          'div',
          null,
          h(Teleport, { to: '#t' }, h('span', null, text.value)),
          showSecond.value
            ? h(Teleport, { to: '#t' }, h('b', null, 'B'))
            : null,
          h('p', null, 'after'),
        )
    })

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)

    expect(target.textContent).toBe('AB')
    // 父容器顺序：Teleport 占位注释 → 后续兄弟 <p>
    const div = root.querySelector('div')!
    expect(div.childNodes[0].nodeType).toBe(Node.COMMENT_NODE)
    expect(div.lastElementChild!.tagName).toBe('P')

    text.value = 'X'
    await nextTick()
    expect(target.textContent).toBe('XB')

    showSecond.value = false
    await nextTick()
    expect(target.textContent).toBe('X')

    app.unmount()
    expect(target.innerHTML).toBe('')
    expect(root.innerHTML).toBe('')
  })

  it('to 切换到新目标：旧目标清空、新目标挂载', async () => {
    const t1 = document.createElement('div')
    t1.id = 't1'
    const t2 = document.createElement('div')
    t2.id = 't2'
    document.body.append(t1, t2)

    let to!: Ref<string>
    const App = testComponent(() => {
      to = ref('#t1')
      return () =>
        h(
          'div',
          null,
          h(Teleport, { to: to.value }, h('span', null, 'content')),
        )
    })

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)

    expect(t1.textContent).toBe('content')
    expect(t2.textContent).toBe('')

    to.value = '#t2'
    await nextTick()
    expect(t1.textContent).toBe('')
    expect(t2.textContent).toBe('content')

    app.unmount()
    expect(t2.textContent).toBe('')
  })
})

// ============================================================
// KeepAlive 多根
// ============================================================
describe('@actview/core 细节债：KeepAlive 多根', () => {
  it('Fragment 多根组件：缓存恢复（setup 不重跑、DOM 复用）', async () => {
    let which!: Ref<'multi' | 'other'>
    let setupCount = 0
    let activatedCount = 0

    const Multi = testComponent(() => {
      setupCount++
      onActivated(() => activatedCount++)
      return () =>
        h(
          Fragment,
          null,
          h('a', { id: 'root-a' }, 'A'),
          h('b', { id: 'root-b' }, 'B'),
        )
    }, 'Multi')

    const Other = testComponent(() => () => h('i', null, 'O'), 'Other')

    const App = testComponent(() => {
      which = ref('multi')
      return () =>
        h(KeepAlive, null, which.value === 'multi' ? h(Multi) : h(Other))
    })

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)
    await nextTick()

    const a = root.querySelector('#root-a')!
    const b = root.querySelector('#root-b')!
    expect(a.textContent).toBe('A')
    expect(b.textContent).toBe('B')

    which.value = 'other'
    await nextTick()
    expect(root.querySelector('#root-a')).toBeNull()
    expect(root.querySelector('#root-b')).toBeNull()
    expect(root.querySelector('i')?.textContent).toBe('O')

    which.value = 'multi'
    await nextTick()
    expect(setupCount).toBe(1)
    expect(activatedCount).toBe(1)
    // DOM 节点复用
    expect(root.querySelector('#root-a')).toBe(a)
    expect(root.querySelector('#root-b')).toBe(b)

    app.unmount()
    expect(root.innerHTML).toBe('')
  })

  it('多根组件失活后节点全部移出文档', async () => {
    let which!: Ref<'multi' | 'other'>
    const Multi = testComponent(
      () => () =>
        h(
          Fragment,
          null,
          h('a', null, 'A'),
          h('b', null, 'B'),
          h('c', null, 'C'),
        ),
      'Multi',
    )
    const Other = testComponent(() => () => h('i', null, 'O'))

    const App = testComponent(() => {
      which = ref('multi')
      return () =>
        h(KeepAlive, null, which.value === 'multi' ? h(Multi) : h(Other))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(root.querySelectorAll('a,b,c')).toHaveLength(3)

    which.value = 'other'
    await nextTick()
    // 失活：所有根节点都离开文档（不只是第一个）
    expect(document.querySelectorAll('a,b,c')).toHaveLength(0)

    which.value = 'multi'
    await nextTick()
    expect(root.querySelectorAll('a,b,c')).toHaveLength(3)
  })
})
