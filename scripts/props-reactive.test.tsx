// ============================================================
// props 响应式验收测试（vitest + happy-dom）
//   props = shallowReactive 代理（对齐 Vue 3）：
//   - computed(() => props.x) 在父组件更新 props 后重算
//   - watch(() => props.x) 触发
//   - render 直接读 props 更新 DOM
//   - shallow 语义：嵌套对象不代理
//   - toRaw(props) 可拿原始对象
//   - 手动 instance.update() 双保险下不双渲染
// 运行：pnpm vitest run scripts/props-reactive.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  createApp,
  reactive,
  ref,
  computed,
  watch,
  toRaw,
  isProxy,
  onUpdated,
  nextTick
} from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'props-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('props 响应式（shallowReactive）', () => {
  it('computed(() => props.x) 在父组件更新 props 后重算', async () => {
    const state = reactive({ label: 'a' })
    let setupCount = 0
    function Child(props: any) {
      setupCount++
      const upper = computed(() => props.label.toUpperCase())
      return <span>{upper.value}</span>
    }
    function App() {
      return <Child label={state.label} />
    }
    const host = mount(App)
    expect(host.querySelector('span')!.textContent).toBe('A')
    expect(setupCount).toBe(1) // setup 只执行一次

    state.label = 'b'
    await flush()
    expect(host.querySelector('span')!.textContent).toBe('B')
    expect(setupCount).toBe(1) // 重渲染不重跑 setup

    state.label = 'c'
    await flush()
    expect(host.querySelector('span')!.textContent).toBe('C')
  })

  it('render 直接读 props 更新 DOM', async () => {
    const state = reactive({ n: 1 })
    function Child(props: any) {
      return <span>{props.n}</span>
    }
    function App() {
      return <Child n={state.n} />
    }
    const host = mount(App)
    expect(host.querySelector('span')!.textContent).toBe('1')
    state.n = 2
    await flush()
    expect(host.querySelector('span')!.textContent).toBe('2')
  })

  it('watch(() => props.x) 在 props 更新后触发（旧值/新值正确）', async () => {
    const state = reactive({ n: 1 })
    const seen: any[] = []
    function Child(props: any) {
      watch(() => props.n, (n, o) => seen.push([n, o]))
      return <span>{props.n}</span>
    }
    function App() {
      return <Child n={state.n} />
    }
    mount(App)
    state.n = 2
    await flush()
    expect(seen).toEqual([[2, 1]])
    state.n = 3
    await flush()
    expect(seen).toEqual([
      [2, 1],
      [3, 2]
    ])
  })

  it('computed-from-props 驱动 class 切换（导航高亮场景）', async () => {
    const route = reactive({ path: '/a' })
    function NavLink(props: any) {
      const isActive = computed(() => route.path === props.href)
      return <a class={isActive.value ? 'active' : ''} href={props.href} />
    }
    function App() {
      return (
        <div>
          <NavLink href="/a" />
          <NavLink href="/b" />
        </div>
      )
    }
    const host = mount(App)
    const links = () =>
      Array.from(host.querySelectorAll('a')).map((a: any) => a.className)
    expect(links()).toEqual(['active', ''])

    route.path = '/b'
    await flush()
    expect(links()).toEqual(['', 'active'])
  })

  it('父组件重渲染 + 子组件 computed(props) 链式更新（VPLink 模式）', async () => {
    const state = reactive({ active: true, text: 'Guide' })
    function VPLink(props: any) {
      const cls = computed(() =>
        ['VPLink', props.class ?? '', props.active ? 'on' : '']
          .filter(Boolean)
          .join(' ')
      )
      return <a class={cls.value}>{props.children ?? null}</a>
    }
    function App() {
      return <VPLink active={state.active}>{state.text}</VPLink>
    }
    const host = mount(App)
    expect(host.querySelector('a')!.className).toBe('VPLink on')

    state.active = false
    state.text = 'Reference'
    await flush()
    expect(host.querySelector('a')!.className).toBe('VPLink')
    expect(host.querySelector('a')!.textContent).toBe('Reference')
  })

  it('shallow 语义：嵌套对象不代理，props 自身是代理', () => {
    const plain = { deep: { x: 1 } }
    let captured: any
    function Child(props: any) {
      captured = props
      return <span>{props.item.deep.x}</span>
    }
    function App() {
      // 直接传普通对象：验证 props 代理不包装嵌套值（shallow）
      return <Child item={plain} />
    }
    mount(App)
    expect(isProxy(captured)).toBe(true)
    // shallow：嵌套对象保持原引用（未包装）
    expect(captured.item).toBe(plain)
    expect(isProxy(captured.item)).toBe(false)
  })

  it('toRaw(props) 返回原始对象', () => {
    const state = reactive({ x: 1 })
    let captured: any
    function Child(props: any) {
      captured = props
      return <span>{props.x}</span>
    }
    function App() {
      return <Child x={state.x} />
    }
    mount(App)
    const raw = toRaw(captured)
    expect(isProxy(raw)).toBe(false)
    expect(raw.x).toBe(1)
  })

  it('props 更新 + 手动 update 双路径不双渲染（onUpdated 只触发一次）', async () => {
    const state = reactive({ n: 1 })
    let childUpdated = 0
    function Child(props: any) {
      onUpdated(() => childUpdated++)
      return <span>{props.n}</span>
    }
    function App() {
      return <Child n={state.n} />
    }
    mount(App)
    state.n = 2
    await flush()
    expect(childUpdated).toBe(1)
  })
})
