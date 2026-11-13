import { testComponent } from './test-helper'
// ============================================================
// @actview/core M1 渲染器测试（happy-dom）
//   覆盖 docs/renderer.md
//   挂载 / 归一化 / 响应式更新（批处理）/ props 父子联动 /
//   条件切换卸载挂载 / 卸载停止更新 / 生命周期顺序 / 事件 / ref
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Fragment,
  createApp,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
} from '../src/index'
import { createVNode } from '../src/internal'
import type { VNode } from '../src/internal'
import { ref } from '@actview/reactivity'
import type { Ref } from '@actview/reactivity'

type Props = Record<string, any> | null

/** 测试用元素工厂（等价 jsx runtime：children 放 props.children） */
function h(type: any, props: Props = null, ...children: any[]): VNode {
  const merged: Record<string, any> = { ...(props ?? {}) }
  if (children.length === 1) merged.children = children[0]
  else if (children.length > 1) merged.children = children
  return createVNode(type, merged)
}

/** 挂载容器（追加到 body，afterEach 清理） */
function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

// ============================================================
// 1. 挂载
// ============================================================
describe('@actview/core M1：挂载', () => {
  it('createApp(App).mount(container) 渲染 DOM', () => {
    const App = testComponent(() => () =>
      h('div', { id: 'app' }, h('span', { class: 'label' }, 'hello')),
    )
    const root = mountRoot()
    createApp(App).mount(root)

    const app = root.querySelector('#app')
    expect(app).not.toBeNull()
    expect(app!.querySelector('span')!.textContent).toBe('hello')
    expect(app!.querySelector('span')!.className).toBe('label')
  })

  it('支持字符串 selector 挂载', () => {
    const host = document.createElement('div')
    host.id = 'host'
    document.body.appendChild(host)

    const App = testComponent(() => () => h('p', null, 'from selector'))
    createApp(App).mount('#host')
    expect(host.querySelector('p')!.textContent).toBe('from selector')
  })

  it('重复挂载同一容器给出 warning（不抛错）', () => {
    const root = mountRoot()
    const App = testComponent(() => () => h('div'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createApp(App).mount(root)
    createApp(App).mount(root)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('根组件必须是 testComponent 组件，否则抛错', () => {
    const root = mountRoot()
    expect(() => createApp((() => h('div')) as any).mount(root)).toThrow()
  })
})

// ============================================================
// 2. 渲染值归一化
// ============================================================
describe('@actview/core M1：渲染值归一化', () => {
  it('string / number / null / boolean / 数组 / Fragment', () => {
    const cases: Array<[any, string]> = [
      ['hi', 'hi'],
      [42, '42'],
      [null, ''],
      [true, ''],
      [['a', h('b', null, 'c')], 'ac'],
      [h(Fragment, null, 'x', h('i', null, 'y')), 'xy'],
    ]

    for (const [value, expected] of cases) {
      const App = testComponent(() => () => value)
      const root = mountRoot()
      createApp(App).mount(root)
      expect(root.textContent).toBe(expected)
    }
  })
})

// ============================================================
// 3. 响应式更新 + 批处理
// ============================================================
describe('@actview/core M1：响应式更新', () => {
  it('ref 变化 → nextTick 后 DOM 更新，且只重跑 render（setup 不重跑）', async () => {
    let count!: Ref<number>
    let setupCount = 0
    let renderCount = 0

    const App = testComponent(() => {
      setupCount++
      count = ref(0)
      return () => {
        renderCount++
        return h('div', null, String(count.value))
      }
    })

    const root = mountRoot()
    createApp(App).mount(root)
    expect(root.textContent).toBe('0')
    expect(setupCount).toBe(1)
    expect(renderCount).toBe(1)

    count.value = 1
    await nextTick()
    expect(root.textContent).toBe('1')
    expect(setupCount).toBe(1)
    expect(renderCount).toBe(2)
  })

  it('同一 tick 多次变化只触发一次 render（批处理）', async () => {
    let count!: Ref<number>
    let renderCount = 0

    const App = testComponent(() => {
      count = ref(0)
      return () => {
        renderCount++
        return h('div', null, String(count.value))
      }
    })

    const root = mountRoot()
    createApp(App).mount(root)
    expect(renderCount).toBe(1)

    count.value = 1
    count.value = 2
    count.value = 3
    await nextTick()

    expect(root.textContent).toBe('3')
    expect(renderCount).toBe(2)
  })

  it('元素文本子节点逐位 patch（不重建 DOM 节点）', async () => {
    let count!: Ref<number>
    const App = testComponent(() => {
      count = ref(0)
      return () => h('div', null, 'count: ', String(count.value))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const div = root.firstElementChild!
    const textNode = div.firstChild

    count.value = 1
    await nextTick()

    expect(div.textContent).toBe('count: 1')
    // 位置对齐 → 逐位 patch：文本节点是同一个（未被卸载重建）
    expect(div.firstChild).toBe(textNode)
  })
})

// ============================================================
// 4. props 父子联动
// ============================================================
describe('@actview/core M1：props 更新', () => {
  it('父状态变化 → 子 props 更新（子 setup 不重跑，render 重跑一次）', async () => {
    let parentCount!: Ref<number>
    let childSetupCount = 0
    let childRenderCount = 0

    const Child = testComponent((props: any) => {
      childSetupCount++
      return () => {
        childRenderCount++
        return h('span', null, String(props.value))
      }
    })

    const Parent = testComponent(() => {
      parentCount = ref(0)
      return () => h('div', null, h(Child, { value: parentCount.value }))
    })

    const root = mountRoot()
    createApp(Parent).mount(root)
    expect(root.textContent).toBe('0')
    expect(childSetupCount).toBe(1)
    expect(childRenderCount).toBe(1)

    parentCount.value = 7
    await nextTick()

    expect(root.textContent).toBe('7')
    expect(childSetupCount).toBe(1)
    expect(childRenderCount).toBe(2)
  })
})

// ============================================================
// 5. 条件渲染 / 组件切换
// ============================================================
describe('@actview/core M1：条件渲染与卸载', () => {
  it('组件类型切换 → 旧组件 unmount、新组件 mount', async () => {
    let visible!: Ref<boolean>
    const logs: string[] = []

    const A = testComponent(() => {
      onUnmounted(() => logs.push('A-unmounted'))
      return () => h('a', null, 'A')
    })
    const B = testComponent(() => {
      onMounted(() => logs.push('B-mounted'))
      return () => h('b', null, 'B')
    })
    const App = testComponent(() => {
      visible = ref(true)
      return () => h('div', null, visible.value ? h(A) : h(B))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(root.querySelector('a')).not.toBeNull()

    visible.value = false
    await nextTick()

    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('b')).not.toBeNull()
    expect(logs).toContain('A-unmounted')
    expect(logs).toContain('B-mounted')
  })
})

// ============================================================
// 6. 卸载
// ============================================================
describe('@actview/core M1：卸载', () => {
  it('app.unmount() 移除 DOM 并停止 render effect', async () => {
    let count!: Ref<number>
    let renderCount = 0

    const App = testComponent(() => {
      count = ref(0)
      return () => {
        renderCount++
        return h('div', null, String(count.value))
      }
    })

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)
    expect(renderCount).toBe(1)

    app.unmount()
    expect(root.innerHTML).toBe('')
    expect(root.querySelector('div')).toBeNull()

    count.value = 1
    await nextTick()
    expect(renderCount).toBe(1) // effect 已停止
  })
})

// ============================================================
// 7. 生命周期顺序
// ============================================================
describe('@actview/core M1：生命周期', () => {
  it('挂载：父 beforeMount → 子 beforeMount → 子 mounted → 父 mounted', async () => {
    const logs: string[] = []

    const Child = testComponent(() => {
      onBeforeMount(() => logs.push('child-beforeMount'))
      onMounted(() => logs.push('child-mounted'))
      return () => h('i', null, 'child')
    })
    const Parent = testComponent(() => {
      onBeforeMount(() => logs.push('parent-beforeMount'))
      onMounted(() => logs.push('parent-mounted'))
      return () => h('div', null, h(Child))
    })

    const root = mountRoot()
    createApp(Parent).mount(root)
    await nextTick()

    expect(logs).toEqual([
      'parent-beforeMount',
      'child-beforeMount',
      'child-mounted',
      'parent-mounted',
    ])
  })

  it('卸载：父 beforeUnmount → 子 beforeUnmount → 子 unmounted → 父 unmounted', async () => {
    const logs: string[] = []

    const Child = testComponent(() => {
      onBeforeUnmount(() => logs.push('child-beforeUnmount'))
      onUnmounted(() => logs.push('child-unmounted'))
      return () => h('i', null, 'child')
    })
    const Parent = testComponent(() => {
      onBeforeUnmount(() => logs.push('parent-beforeUnmount'))
      onUnmounted(() => logs.push('parent-unmounted'))
      return () => h('div', null, h(Child))
    })

    const root = mountRoot()
    const app = createApp(Parent)
    app.mount(root)
    await nextTick()

    app.unmount()
    await nextTick()

    expect(logs).toEqual([
      'parent-beforeUnmount',
      'child-beforeUnmount',
      'child-unmounted',
      'parent-unmounted',
    ])
  })
})

// ============================================================
// 8. 事件
// ============================================================
describe('@actview/core M1：事件', () => {
  it('onClick 更新状态；重渲染后监听器被替换（不重复触发）', async () => {
    let count!: Ref<number>
    const App = testComponent(() => {
      count = ref(0)
      return () =>
        h('button', { onClick: () => count.value++ }, String(count.value))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const button = root.querySelector('button')!

    button.click()
    await nextTick()
    expect(button.textContent).toBe('1')

    // 若旧监听器未移除，这次点击会 +2
    button.click()
    await nextTick()
    expect(button.textContent).toBe('2')
  })
})

// ============================================================
// 9. ref
// ============================================================
describe('@actview/core M1：ref', () => {
  it('元素 ref 指向 DOM；卸载后置 null', () => {
    const elRef = ref<HTMLElement | null>(null)
    const App = testComponent(() => () => h('input', { ref: elRef }))

    const root = mountRoot()
    const app = createApp(App)
    app.mount(root)

    expect(elRef.value).not.toBeNull()
    expect(elRef.value!.tagName).toBe('INPUT')

    app.unmount()
    expect(elRef.value).toBeNull()
  })
})
