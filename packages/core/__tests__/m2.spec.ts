import { testComponent } from './test-helper'
// ============================================================
// @actview/core M2 验收测试（happy-dom）
//   - children diff：keyed（重排/反转/插入/删除/组件实例保持）/ unkeyed
//   - provide / inject（嵌套、兄弟隔离、app.provide、默认值）
//   - public instance proxy（$props/$el/$parent/$root/$forceUpdate/$nextTick/$）
//   - shouldUpdateComponent / $forceUpdate
//   - nextTick 回调语义
//   - patchProp 完整：DOM property / class / style / 事件 options / innerHTML / SVG
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createApp,
  inject,
  nextTick,
  onMounted,
  provide,
} from '../src/index'
import type { ComponentPublicInstance } from '../src/index'
import { createVNode } from '../src/internal'
import type { VNode } from '../src/internal'
import { ref } from '@actview/reactivity'
import type { Ref } from '@actview/reactivity'

type Props = Record<string, any> | null

/** 测试用元素工厂（key 提升为 VNode key，等价 jsx runtime） */
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

afterEach(() => {
  document.body.innerHTML = ''
})

// ============================================================
// 1. children diff：keyed
// ============================================================
describe('@actview/core M2：keyed children diff', () => {
  function createList() {
    let order!: Ref<number[]>
    const App = testComponent(() => {
      order = ref([1, 2, 3])
      return () =>
        h(
          'ul',
          null,
          ...order.value.map((id) => h('li', { key: id }, String(id))),
        )
    })
    const root = mountRoot()
    createApp(App).mount(root)
    const ul = root.querySelector('ul')!
    return { order, ul }
  }

  it('重排：DOM 节点复用（不重建），顺序更新', async () => {
    const { order, ul } = createList()
    const before = Array.from(ul.children)
    expect(before.map((el) => el.textContent)).toEqual(['1', '2', '3'])

    order.value = [3, 1, 2]
    await nextTick()

    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      '3',
      '1',
      '2',
    ])
    // 同一批 DOM 节点被移动复用（不是重新创建）
    expect(ul.children[0]).toBe(before[2])
    expect(ul.children[1]).toBe(before[0])
    expect(ul.children[2]).toBe(before[1])
  })

  it('反转 + 插入 + 删除', async () => {
    const { order, ul } = createList()
    const before = Array.from(ul.children)

    // 删除 2，保留 1/3，插入 4 → 顺序 [3,4,1]
    order.value = [3, 4, 1]
    await nextTick()

    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      '3',
      '4',
      '1',
    ])
    expect(ul.children[0]).toBe(before[2]) // 3 复用
    expect(ul.children[2]).toBe(before[0]) // 1 复用
    expect(before[1].isConnected).toBe(false) // 2 被移除
    expect(ul.children[1].textContent).toBe('4')
  })

  it('keyed 组件：重排时实例保持（setup 不重跑、状态保留）', async () => {
    let order!: Ref<number[]>
    const setupCounts = new Map<number, number>()
    const renderCounts = new Map<number, number>()

    const Item = testComponent((props: any) => {
      setupCounts.set(props.id, (setupCounts.get(props.id) ?? 0) + 1)
      return () => {
        renderCounts.set(props.id, (renderCounts.get(props.id) ?? 0) + 1)
        return h('li', null, `${props.id}:${props.label}`)
      }
    })

    const App = testComponent(() => {
      order = ref([1, 2, 3])
      const labels: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c' }
      return () =>
        h(
          'ul',
          null,
          ...order.value.map((id) =>
            h(Item, { key: id, id, label: labels[id] }),
          ),
        )
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const ul = root.querySelector('ul')!
    const before = Array.from(ul.children)
    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      '1:a',
      '2:b',
      '3:c',
    ])

    order.value = [3, 2, 1]
    await nextTick()

    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      '3:c',
      '2:b',
      '1:a',
    ])
    // 实例复用：每项 setup 只跑过一次；重排只是移动 DOM（props 未变 → render 不重跑）
    expect([...setupCounts.values()]).toEqual([1, 1, 1])
    // DOM 节点复用
    expect(ul.children[0]).toBe(before[2])
    expect(ul.children[2]).toBe(before[0])
    expect([...renderCounts.values()]).toEqual([1, 1, 1])
  })

  it('unkeyed：长度变化（缩短 / 加长）', async () => {
    let items!: Ref<string[]>
    const App = testComponent(() => {
      items = ref(['a', 'b', 'c'])
      return () =>
        h('ul', null, ...items.value.map((text) => h('li', null, text)))
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const ul = root.querySelector('ul')!

    items.value = ['x', 'y']
    await nextTick()
    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      'x',
      'y',
    ])

    items.value = ['x', 'y', 'z']
    await nextTick()
    expect(Array.from(ul.children).map((el) => el.textContent)).toEqual([
      'x',
      'y',
      'z',
    ])
  })
})

// ============================================================
// 2. provide / inject
// ============================================================
describe('@actview/core M2：provide / inject', () => {
  it('祖先 provide，后代 inject（跨层级）', () => {
    const THEME = 'theme'

    const GrandChild = testComponent(() => {
      const theme = inject(THEME, 'unknown')
      return () => h('span', null, String(theme))
    })
    const Child = testComponent(() => () => h('div', null, h(GrandChild)))
    const Provider = testComponent(() => {
      provide(THEME, 'dark')
      return () => h(Child)
    })

    const root = mountRoot()
    createApp(Provider).mount(root)
    expect(root.textContent).toBe('dark')
  })

  it('兄弟隔离：provide 的 copy-on-write 不污染兄弟', () => {
    const KEY = 'color'

    const Leaf = testComponent(() => {
      const color = inject(KEY, 'default')
      return () => h('i', null, String(color))
    })
    const Provider = testComponent(() => {
      provide(KEY, 'red')
      return () => h(Leaf)
    })
    const Plain = testComponent(() => () => h(Leaf))

    const App = testComponent(() => () => h('div', null, h(Provider), h(Plain)))

    const root = mountRoot()
    createApp(App).mount(root)

    const [providerLeaf, plainLeaf] = Array.from(root.querySelectorAll('i'))
    expect(providerLeaf.textContent).toBe('red')
    expect(plainLeaf.textContent).toBe('default')
  })

  it('app.provide：根注入表对整棵树可见', () => {
    const THEME = 'theme'
    const App = testComponent(() => {
      const theme = inject(THEME, 'light')
      return () => h('span', null, String(theme))
    })

    const root = mountRoot()
    const app = createApp(App)
    app.provide(THEME, 'dark')
    app.mount(root)

    expect(root.textContent).toBe('dark')
  })

  it('inject 默认值与未提供返回 undefined', () => {
    let provided: unknown
    let missing: unknown

    const App = testComponent(() => {
      provided = inject('missing', 'fallback')
      missing = inject('missing')
      return () => h('div')
    })

    const root = mountRoot()
    createApp(App).mount(root)
    expect(provided).toBe('fallback')
    expect(missing).toBeUndefined()
  })
})

// ============================================================
// 3. public instance proxy
// ============================================================
describe('@actview/core M2：public instance proxy', () => {
  it('app.mount 返回公开实例；$props/$el/$parent/$root/$ 可用', () => {
    const Child = testComponent((props: any) => () =>
      h('span', { id: 'child' }, String(props.msg)),
    )
    const App = testComponent(() => () => h('div', null, h(Child, { msg: 'hi' })))

    const root = mountRoot()
    const app = createApp(App, { rootProp: 1 })
    const instance = app.mount(root) as ComponentPublicInstance

    expect(instance).not.toBeNull()
    expect(instance.$props.rootProp).toBe(1)
    expect(instance.$el).toBe(root.querySelector('div'))
    expect(instance.$parent).toBeNull()
    expect(instance.$root).toBe(instance)
    // 内部实例可经 `$` 逃逸访问（container 属渲染器内部字段）
    expect((instance.$ as any).container).toBe(root)
    expect(typeof instance.$forceUpdate).toBe('function')
    expect(typeof instance.$nextTick).toBe('function')
  })

  it('子组件 proxy：$parent / $root 指向正确', () => {
    let childProxy: ComponentPublicInstance | null = null
    const childRef = (value: ComponentPublicInstance | null) => {
      childProxy = value
    }
    const Child = testComponent(() => () => h('span', null, 'child'))
    const App = testComponent(() => () => h('div', null, h(Child, { ref: childRef })))

    const root = mountRoot()
    const appInstance = createApp(App).mount(root) as ComponentPublicInstance

    expect(childProxy).not.toBeNull()
    expect(childProxy!.$parent).toBe(appInstance)
    expect(childProxy!.$root).toBe(appInstance)
    expect(childProxy!.$el).toBe(root.querySelector('span'))
  })

  it('$forceUpdate 强制重渲染（跳过 props 比较）', async () => {
    let proxy!: ComponentPublicInstance
    let renderCount = 0

    const Child = testComponent(() => () => {
      renderCount++
      return h('span', null, 'child')
    })
    const App = testComponent(() => () => h('div', null, h(Child)))

    const root = mountRoot()
    createApp(App).mount(root)

    // 通过根实例找不到子 proxy，直接构造一个暴露 ref 的组件拿 proxy
    const WithRef = testComponent(() => () =>
      h(Child, { ref: (v: any) => (proxy = v) }),
    )
    const root2 = mountRoot()
    createApp(WithRef).mount(root2)

    expect(renderCount).toBe(2) // 两次挂载各渲染一次
    proxy.$forceUpdate()
    await nextTick()
    expect(renderCount).toBe(3)
  })

  it('$nextTick 返回回执并等待 DOM 更新', async () => {
    let proxy!: ComponentPublicInstance
    let count!: Ref<number>

    const App = testComponent(() => {
      count = ref(0)
      return () =>
        h('div', { ref: (v: any) => (proxy = v) }, String(count.value))
    })

    const root = mountRoot()
    const appInstance = createApp(App).mount(root) as ComponentPublicInstance
    expect(appInstance.$el).toBe(root.firstElementChild)

    count.value = 5
    const result = await appInstance.$nextTick(() => 'done')
    expect(result).toBe('done')
    expect(root.textContent).toBe('5')
  })
})

// ============================================================
// 4. shouldUpdateComponent / nextTick
// ============================================================
describe('@actview/core M2：更新优化与 nextTick', () => {
  it('父重渲染但子 props 未变 → 子 render 不重跑', async () => {
    let parentCount!: Ref<number>
    let childRenderCount = 0

    const Child = testComponent(() => () => {
      childRenderCount++
      return h('span', null, 'stable')
    })
    const Parent = testComponent(() => {
      parentCount = ref(0)
      return () =>
        h('div', null, h('span', null, String(parentCount.value)), h(Child))
    })

    const root = mountRoot()
    createApp(Parent).mount(root)
    expect(childRenderCount).toBe(1)

    parentCount.value = 1
    await nextTick()

    expect(root.querySelector('span')!.textContent).toBe('1')
    expect(childRenderCount).toBe(1) // props 无变化，子未重渲染
  })

  it('nextTick 回调返回值 / 无调用时 resolve', async () => {
    expect(await nextTick(() => 42)).toBe(42)
    await expect(nextTick()).resolves.toBeUndefined()
  })

  it('mounted 中 nextTick 在 DOM 就绪后执行', async () => {
    const logs: string[] = []
    const App = testComponent(() => {
      onMounted(() => {
        logs.push('mounted')
        nextTick(() => logs.push('tick'))
      })
      return () => h('div', null, 'x')
    })

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    await nextTick()

    expect(logs).toEqual(['mounted', 'tick'])
  })
})

// ============================================================
// 5. patchProp 完整语义
// ============================================================
describe('@actview/core M2：DOM property / class / style', () => {
  it('input value / checked / disabled 走 DOM property', async () => {
    let text!: Ref<string>
    let disabled!: Ref<boolean>

    const App = testComponent(() => {
      text = ref('hello')
      disabled = ref(false)
      return () =>
        h('input', {
          value: text.value,
          checked: true,
          disabled: disabled.value,
        })
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const input = root.querySelector('input')!

    expect(input.value).toBe('hello')
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(false)

    text.value = 'world'
    disabled.value = true
    await nextTick()

    expect(input.value).toBe('world')
    expect(input.disabled).toBe(true)
  })

  it('class：string / array / object 归一化', async () => {
    let cls!: Ref<any>
    const App = testComponent(() => {
      cls = ref('a b')
      return () => h('div', { class: cls.value })
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const div = root.querySelector('div')!

    expect(div.className).toBe('a b')

    cls.value = ['a', 'c', null, false]
    await nextTick()
    expect(div.className).toBe('a c')

    cls.value = { a: true, b: false, d: true }
    await nextTick()
    expect(div.className).toBe('a d')

    cls.value = null
    await nextTick()
    expect(div.className).toBe('')
  })

  it('style：对象 / string / 移除旧 key', async () => {
    let style!: Ref<any>
    const App = testComponent(() => {
      style = ref({ color: 'red', fontSize: '12px' })
      return () => h('div', { style: style.value })
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const div = root.querySelector('div')!

    expect(div.style.color).toBe('red')
    expect(div.style.fontSize).toBe('12px')

    style.value = { color: 'blue' }
    await nextTick()
    expect(div.style.color).toBe('blue')
    expect(div.style.fontSize).toBe('')

    style.value = 'color: green'
    await nextTick()
    expect(div.style.color).toBe('green')
  })

  it('innerHTML / textContent 特殊 props', async () => {
    let html!: Ref<string>
    const App = testComponent(() => {
      html = ref('<b>one</b>')
      return () => h('div', { innerHTML: html.value })
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const div = root.querySelector('div')!
    expect(div.innerHTML).toBe('<b>one</b>')

    html.value = '<i>two</i>'
    await nextTick()
    expect(div.innerHTML).toBe('<i>two</i>')
  })
})

describe('@actview/core M2：事件与 SVG', () => {
  it('事件 options：once 只触发一次', async () => {
    let clicks = 0
    const App = testComponent(() => () =>
      h('button', {
        onClick: { handler: () => clicks++, once: true },
      }),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    const button = root.querySelector('button')!

    button.click()
    button.click()
    expect(clicks).toBe(1)
  })

  it('事件后缀 Capture 走 capture 选项', async () => {
    let count!: Ref<number>
    let clicked = 0
    const App = testComponent(() => {
      count = ref(0)
      return () =>
        h(
          'button',
          { onClickCapture: () => clicked++ },
          String(count.value),
        )
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const button = root.querySelector('button')!

    // happy-dom 的元素并不继承全局 EventTarget，因此 spy 实例方法
    const addSpy = vi.spyOn(button, 'addEventListener')
    // 触发重渲染 → handler 闭包变化 → patchProp 重新 addEventListener
    count.value = 1
    await nextTick()

    const captureCall = addSpy.mock.calls.find((args) => args[0] === 'click')
    expect(captureCall).toBeTruthy()
    expect((captureCall![2] as AddEventListenerOptions)?.capture).toBe(true)
    addSpy.mockRestore()

    // 行为：capture 监听器在目标上也会触发
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicked).toBe(1)
  })

  it('SVG 元素使用正确 namespace', () => {
    const SVG_NS = 'http://www.w3.org/2000/svg'
    const App = testComponent(() => () =>
      h('svg', { viewBox: '0 0 10 10' }, h('circle', { r: '5', cx: '5', cy: '5' })),
    )

    const root = mountRoot()
    createApp(App).mount(root)
    const svg = root.querySelector('svg')!
    const circle = root.querySelector('circle')!

    expect(svg.namespaceURI).toBe(SVG_NS)
    expect(circle.namespaceURI).toBe(SVG_NS)
    expect(circle.getAttribute('r')).toBe('5')
    expect(svg.getAttribute('viewBox')).toBe('0 0 10 10')
  })

  it('属性移除：旧 props 删除后 removeAttribute', async () => {
    let title!: Ref<string | null>
    const App = testComponent(() => {
      title = ref('hello')
      return () => h('div', { title: title.value ?? null })
    })

    const root = mountRoot()
    createApp(App).mount(root)
    const div = root.querySelector('div')!
    expect(div.getAttribute('title')).toBe('hello')

    title.value = null
    await nextTick()
    expect(div.hasAttribute('title')).toBe(false)
  })
})
