// ============================================================
// props 响应式验收 + props 细粒度更新 + 依赖隔离 + 显式透传
// （拆分自 test/props-reactive.test.tsx + test/verify.test.tsx 场景 3/4/27）
// 运行：pnpm exec vitest run test/component/props.test.tsx
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
  nextTick,
  defineComponent
} from 'actview'

// ---------- helpers（来自 test/props-reactive.test.tsx）----------
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'props-host-' + mountSeq++
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
// test/props-reactive.test.tsx 整文件
// ============================================================
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
    expect(setupCount).toBe(1)

    state.label = 'b'
    await flush()
    expect(host.querySelector('span')!.textContent).toBe('B')
    expect(setupCount).toBe(1)

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
      return <Child item={plain} />
    }
    mount(App)
    expect(isProxy(captured)).toBe(true)
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

// ============================================================
// test/verify.test.tsx — 场景 3：props 细粒度更新
// ============================================================
describe('场景 3：props 细粒度更新', () => {
  it('setup 只执行一次，props 更新不重挂', async () => {
    let childSetupCount = 0
    function Child(props: { msg: string }) {
      childSetupCount++
      return <span class="child">{props.msg}</span>
    }
    const state = reactive({ msg: 'hello' })
    function Parent() {
      return <div class="parent"><Child msg={state.msg} /></div>
    }
    const host = mountId('#s3', Parent)
    const span = host.children[0].children[0]
    expect(childSetupCount).toBe(1)
    expect(span.textContent).toBe('hello')

    state.msg = 'world'
    await nextTick()
    expect(span.textContent).toBe('world')
    expect(childSetupCount).toBe(1)
    expect(host.children[0].children[0]).toBe(span)
  })
})

// ============================================================
// test/verify.test.tsx — 场景 4：依赖隔离
// ============================================================
describe('场景 4：依赖隔离', () => {
  it('子组件内部状态变化不连带父组件重渲染', async () => {
    let parentRenderCount = 0
    function markParentRender() {
      parentRenderCount++
      return ''
    }
    const innerState = reactive({ local: 'inner' })
    function ChildWithLocal(props: { msg: string }) {
      return (
        <div class="child-local">
          <span>prop: {props.msg} | local: {innerState.local}</span>
        </div>
      )
    }
    const parentState = reactive({ msg: 'hello2' })
    function ParentWithLocal() {
      return (
        <div class="parent-local">
          {markParentRender()}
          <ChildWithLocal msg={parentState.msg} />
        </div>
      )
    }
    const host = mountId('#s4', ParentWithLocal)
    expect(parentRenderCount).toBe(1)

    innerState.local = 'changed'
    await nextTick()
    expect(collectText(host)).toContain('local: changed')
    expect(parentRenderCount).toBe(1)

    parentState.msg = 'hello2!'
    await nextTick()
    expect(collectText(host)).toContain('prop: hello2!')
    expect(parentRenderCount).toBe(2)

    // 核心：props 更新路径之后，子内部状态再变化不得连带父组件
    innerState.local = 'again'
    await nextTick()
    expect(collectText(host)).toContain('local: again')
    expect(parentRenderCount).toBe(2)
  })
})

// ============================================================
// test/verify.test.tsx — 场景 27：props 全量 + 显式透传
// ============================================================
describe('场景 27：props 全量 + 显式透传', () => {
  it('props 全量进 setup：业务 props 与 class 都能读到', () => {
    let captured: any
    function Content(props: any) {
      captured = props
      return <div class="content-body">{props.children}</div>
    }
    function App() {
      return <Content class="vp-doc" title="t" features={[1, 2]}>内容</Content>
    }
    mountId('#s27a', App)
    expect(captured.class).toBe('vp-doc')
    expect(captured.title).toBe('t')
    expect(captured.features).toEqual([1, 2])
  })

  it('不显式透传：外部 class/属性不落根元素（方案 3 核心语义）', () => {
    function Content(props: any) {
      return <div class="content-body">{props.children}</div>
    }
    function App() {
      return <Content class="vp-doc" title="t">内容</Content>
    }
    const host = mountId('#s27b', App)
    const root = host.querySelector('.content-body')!
    expect(root.classList.contains('vp-doc')).toBe(false)
    expect(root.getAttribute('title')).toBeNull()
  })

  it('显式 {...props} 透传：class/属性落根', () => {
    function Panel(props: any) {
      return <div {...props} class="panel">P</div>
    }
    function App() {
      return <Panel class="extra" title="t" data-x="1" />
    }
    const host = mountId('#s27c', App)
    const div = host.querySelector('.panel')!
    // spread 在前、class 在后 → 自带 class 覆盖外部
    expect(div.className).toBe('panel')
    expect(div.getAttribute('title')).toBe('t')
    expect(div.getAttribute('data-x')).toBe('1')
  })

  it('class 手动拼接：组件自带 + 外部共存', () => {
    function Panel({ class: cls, ...rest }: any) {
      return <div class={['panel', cls].filter(Boolean).join(' ')} {...rest}>P</div>
    }
    function App() {
      return <Panel class="extra-1 extra-2" />
    }
    const host = mountId('#s27d', App)
    const sec = host.querySelector('.panel')!
    expect(sec.classList.contains('panel')).toBe(true)
    expect(sec.classList.contains('extra-1')).toBe(true)
    expect(sec.classList.contains('extra-2')).toBe(true)
  })

  it('scoped 跨文件继承：data-v-* 经显式 {...props} 落子根，多级累积', () => {
    function Leaf(props: any) {
      return <div class="leaf" {...props}>L</div>
    }
    const Mid = defineComponent(function (props: any) {
      return () => <Leaf {...props} />
    })
    function Root() {
      return <Mid data-v-parent="abc123" />
    }
    const host = mountId('#s27e', Root)
    const leaf = host.querySelector('.leaf')!
    expect(leaf.getAttribute('data-v-parent')).toBe('abc123')
  })

  it('事件 props：父组件传回调，子组件显式绑定', () => {
    let clicked = 0
    function Wrap(props: any) {
      return <button class="wrap" onclick={props.onClick}>W</button>
    }
    function App() {
      return <Wrap onClick={() => clicked++} />
    }
    const host = mountId('#s27f', App)
    host.querySelector('.wrap')!.dispatchEvent(new Event('click'))
    expect(clicked).toBe(1)
  })

  it('key/ref 不进 props（React 语义）', () => {
    let captured: any
    let refVal: any = null
    function Item(props: any) {
      captured = props
      return <li class="item">{props.children}</li>
    }
    function App() {
      return <Item key="k1" ref={(el: any) => (refVal = el)}>文本</Item>
    }
    const host = mountId('#s27g', App)
    expect(captured.key).toBeUndefined()
    expect(captured.ref).toBeUndefined()
    expect(host.querySelector('.item')!.textContent).toBe('文本')
    expect(refVal).not.toBeNull()
  })

  it('props 更新：父组件 props 变化触发子组件重渲染', async () => {
    const state = reactive({ cls: 'a' })
    function Content(props: any) {
      return <div class={`body ${props.class ?? ''}`.trim()}>B</div>
    }
    function App() {
      return <Content class={state.cls} />
    }
    const host = mountId('#s27h', App)
    const root = host.querySelector('.body')!
    expect(root.classList.contains('a')).toBe(true)
    state.cls = 'b'
    await nextTick()
    expect(root.classList.contains('b')).toBe(true)
  })
})