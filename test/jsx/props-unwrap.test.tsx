// ============================================================
// JSX props 自动解包（jsxFactory unwrapProps）
//   属性值为 ref/computedRef（带 __v_isRef 标记）时，创建 vnode 时读取
//   .value，消费方收到解包后的普通值；解包发生在 JSX 表达式求值处
//   （组件 render effect 内），读 ref.value 会 track 渲染 effect →
//   ref 变化 → 重渲染 → 新值传递（响应式 props）。
// 运行：pnpm exec vitest run test/jsx/props-unwrap.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  ref,
  computed,
  shallowRef,
  isRef,
  nextTick,
  toRefs,
  reactive,
  rawRef
} from 'actview'
import { jsx, createElement } from '@actview/jsx'

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'unwrap-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ============================================================
// 单元级：jsxFactory 解包行为
// ============================================================
describe('jsxFactory props 自动解包（单元级）', () => {
  it('非 ref 值原样透传，props 对象引用不变（零拷贝）', () => {
    const config = { title: 't', n: 1 }
    const vnode = jsx('div', config)
    expect(vnode.props).toBe(config)
    expect(vnode.props.title).toBe('t')
  })

  it('ref 属性自动解包为 .value', () => {
    const count = ref(1)
    const vnode = jsx('div', { count })
    expect(vnode.props.count).toBe(1)
    expect(isRef(vnode.props.count)).toBe(false)
  })

  it('computedRef / shallowRef 同样解包', () => {
    const base = ref(2)
    const doubled = computed(() => base.value * 2)
    const s = shallowRef({ a: 1 })
    const vnode = jsx('div', { doubled, s })
    expect(vnode.props.doubled).toBe(4)
    expect(vnode.props.s).toEqual({ a: 1 })
  })

  it('ref 键排除：模板引用语义不受解包影响', () => {
    const inputRef = ref<HTMLInputElement | null>(null)
    const vnode = jsx('input', { ref: inputRef })
    expect(vnode.props.ref).toBe(inputRef)
    expect(isRef(vnode.props.ref)).toBe(true)
  })

  it('已解包的 vnode 是快照，重新渲染才取新值', () => {
    const count = ref(1)
    const v1 = jsx('div', { count })
    count.value = 5
    const v2 = jsx('div', { count })
    expect(v1.props.count).toBe(1)
    expect(v2.props.count).toBe(5)
  })

  it('createElement 同样解包', () => {
    const count = ref(3)
    const vnode = createElement('div', { count })
    expect(vnode.props.count).toBe(3)
  })
})

// ============================================================
// rawRef 逃逸口：显式传 ref 本体（跳过自动解包）
// ============================================================
describe('rawRef 逃逸口（不解包标记）', () => {
  it('rawRef 包装的 ref 不被解包：组件收到 ref 本体', () => {
    const myRef = ref<HTMLElement | null>(null)
    const vnode = jsx('div', { inputRef: rawRef(myRef) })
    expect(isRef(vnode.props.inputRef)).toBe(true)
    expect((vnode.props.inputRef as any).__av_raw).toBe(true)
  })

  it('不污染原 ref：委托读写生效，别处照常解包', () => {
    const count = ref(1)
    const raw = rawRef(count)
    // getter/setter 委托原 ref
    expect(raw.value).toBe(1)
    count.value = 5
    expect(raw.value).toBe(5)
    raw.value = 9
    expect(count.value).toBe(9)
    // 原 ref 无 __av_raw 标记 → 其他 props 位置照常解包
    const vnode = jsx('div', { n: count })
    expect(vnode.props.n).toBe(9)
  })
})

// ============================================================
// 渲染链路：响应式传递（核心：解包必须发生在 render effect 内）
// ============================================================
describe('JSX props 解包（渲染链路）', () => {
  it('组件 props 传 ref：setup 收到解包值，ref 变化自动更新', async () => {
    const count = ref(1)
    let captured: any
    function Child(props: any) {
      captured = props
      return <span>{props.count}</span>
    }
    function App() {
      return <Child count={count} />
    }
    const host = mount(App)
    // 组件收到的是解包后的普通值，不是 ref 对象
    expect(isRef(captured.count)).toBe(false)
    expect(captured.count).toBe(1)
    expect(host.querySelector('span')!.textContent).toBe('1')

    // 解包读 count.value track 了 App 的 render effect → 变化自动重渲染
    count.value = 2
    await nextTick()
    expect(host.querySelector('span')!.textContent).toBe('2')
  })

  it('computedRef 传 props：依赖链变化驱动更新', async () => {
    const base = ref(2)
    const doubled = computed(() => base.value * 2)
    function Child(props: any) {
      return <span>{props.n}</span>
    }
    function App() {
      return <Child n={doubled} />
    }
    const host = mount(App)
    expect(host.querySelector('span')!.textContent).toBe('4')

    base.value = 10
    await nextTick()
    expect(host.querySelector('span')!.textContent).toBe('20')
  })

  it('setup 内 ref 传子树：事件驱动更新生效（解包 track 到组件 render effect）', async () => {
    function Child(props: any) {
      return <span>{props.n}</span>
    }
    function App() {
      const n = ref(1) // setup 阶段声明
      return (
        <button class="btn" onclick={() => (n.value = n.value + 1)}>
          <Child n={n} />
        </button>
      )
    }
    const host = mount(App)
    expect(host.querySelector('span')!.textContent).toBe('1')

    // 若解包发生在 setup 阶段（track 被吞），点击后子组件不会更新
    host.querySelector('.btn')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(host.querySelector('span')!.textContent).toBe('2')
  })

  it('原生元素 props 传 ref：DOM 属性响应式更新', async () => {
    const value = ref('a')
    function App() {
      return <input value={value} />
    }
    const host = mount(App)
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('a')

    value.value = 'b'
    await nextTick()
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('b')
  })

  it('children 传 ref：文本子节点自动解包并响应更新', async () => {
    const text = ref('hello')
    function App() {
      return <div>{text}</div>
    }
    const host = mount(App)
    expect(host.querySelector('div')!.textContent).toBe('hello')

    text.value = 'world'
    await nextTick()
    expect(host.querySelector('div')!.textContent).toBe('world')
  })

  it('ref 键仍按模板引用语义写入（不被解包破坏）', async () => {
    const inputRef = ref<HTMLInputElement | null>(null)
    function App() {
      return <input ref={inputRef} />
    }
    const host = mount(App)
    expect(inputRef.value).toBe(host.querySelector('input'))
  })

  it('toRefs(props) 解构 rest 展开透传：ref 集合自动解包并响应更新', async () => {
    function Panel(props: any) {
      const { id, ...rest } = toRefs(props)
      // id 是 Ref，可直接传给 data-id（自动解包）；{...rest} 的每个键
      // 都是 Ref，展开后由 unwrapProps 顶层解包
      return <div class="panel" data-id={id} {...rest}>P</div>
    }
    const state = reactive({ title: 't', hidden: false })
    function App() {
      return <Panel id="p1" title={state.title} hidden={state.hidden} />
    }
    const host = mount(App)
    const div = host.querySelector('.panel')!
    expect(div.getAttribute('data-id')).toBe('p1')
    expect(div.getAttribute('title')).toBe('t')
    expect(div.hidden).toBe(false)

    state.title = 'T2'
    state.hidden = true
    await nextTick()
    expect(div.getAttribute('title')).toBe('T2')
    expect(div.hidden).toBe(true)
  })

  it('rawRef 渲染链路：组件收 ref 本体，写 .value 回原 ref（useMergedRefs 场景）', async () => {
    const myInputRef = ref<HTMLInputElement | null>(null)
    function SwitchRoot(props: any) {
      // props.inputRef 是 rawRef 包装（ref 本体，未解包）——
      // 模拟 useMergedRefs 合并后写 .value，等价 <input ref={merged}>
      const merged = props.inputRef
      return <input ref={(el: any) => { if (merged) merged.value = el }} />
    }
    function App() {
      return <SwitchRoot inputRef={rawRef(myInputRef)} />
    }
    const host = mount(App)
    // 原 ref 通过包装的 setter 拿到真实 input 元素
    expect(myInputRef.value).toBe(host.querySelector('input'))
  })
})
