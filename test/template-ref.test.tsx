// ============================================================
// 模板引用（props.ref）验收测试
//   三种形态等效：ref(null)（Vue 风格）/ { value } 对象 / 函数回调
//   挂载 → 指向 DOM（组件 → 组件实例）；卸载 → 置 null
// 运行：pnpm vitest run test/template-ref.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, ref, defineComponent } from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'tplref-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('模板引用（props.ref）', () => {
  it('ref(null) Vue 风格：挂载后 .value 指向 DOM 元素', () => {
    const inputRef = ref<HTMLElement | null>(null)
    function App() {
      return (
        <div>
          <input ref={inputRef} />
        </div>
      )
    }
    const host = mount(App)
    const input = host.querySelector('input')!
    expect(inputRef.value).toBe(input)
    expect(inputRef.value!.tagName).toBe('INPUT')
  })

  it('{ value } 对象形态：挂载后 .value 指向 DOM', () => {
    const elRef: { value: HTMLElement | null } = { value: null }
    function App() {
      return (
        <div>
          <input ref={elRef} />
        </div>
      )
    }
    const host = mount(App)
    expect(elRef.value).toBe(host.querySelector('input')!)
  })

  it('函数回调形态：挂载时回调收到 DOM 元素', () => {
    let captured: any = null
    function App() {
      return <input ref={(n) => (captured = n)} />
    }
    const host = mount(App)
    expect(captured).toBe(host.querySelector('input')!)
  })

  it('条件渲染切换：ref 随挂载/卸载更新与置 null', async () => {
    const elRef = ref<HTMLElement | null>(null)
    const state = ref(true)
    function App() {
      return <div>{state.value ? <input ref={elRef} /> : <span />}</div>
    }
    const host = mount(App)
    expect(elRef.value).toBe(host.querySelector('input')!)

    state.value = false
    await flush()
    expect(elRef.value).toBeNull() // 卸载 → 置 null
    expect(host.querySelector('input')).toBeNull()

    state.value = true
    await flush()
    expect(elRef.value).toBe(host.querySelector('input')!) // 重新挂载 → 重新赋值
  })

  it('组件 ref：指向组件实例而非 DOM', () => {
    const compRef = ref<any>(null)
    // 测试文件不经 babel 插件转换，defineComponent 内手动返回 render 函数
    // （应用代码里裸函数写法由插件自动包成 render）
    const Child = defineComponent(function () {
      return () => <span>child</span>
    })
    function App() {
      return <Child ref={compRef} />
    }
    const host = mount(App)
    expect(compRef.value).not.toBeNull()
    // 组件实例特征：有 update / subTree / isMounted
    expect(typeof compRef.value.update).toBe('function')
    expect(compRef.value.subTree?.el).toBe(host.querySelector('span')!)
  })

  it('响应式联动：render 读 ref.value，挂载赋值触发重渲染', async () => {
    const inputRef = ref<HTMLElement | null>(null)
    function App() {
      return (
        <div>
          <input ref={inputRef} />
          {inputRef.value ? <span class="ready">ready</span> : null}
        </div>
      )
    }
    const host = mount(App)
    // ref 赋值发生在挂载期间 → 触发依赖（render 里读了 inputRef.value）→ 一次重渲染
    await flush()
    const ready = host.querySelector('.ready')
    expect(ready).not.toBeNull()
    expect(ready!.textContent).toBe('ready')
  })

  it('ref 回调时整条祖先链已连接（前序插入，AI-002 修复）', () => {
    // 修复前：子元素 ref 在父 appendChild 之前触发 → isConnected=false
    // 修复后：前序插入 → 宿主元素先接入容器再挂子 → ref 触发时已连接
    const logs: Array<{ tag: string; connected: boolean }> = []
    function Deep() {
      // 组件层跨层：ref 在子组件内，祖先链含父组件宿主元素
      return (
        <div class="inner">
          <button ref={(n) => logs.push({ tag: 'button', connected: n.isConnected })}>
            x
          </button>
        </div>
      )
    }
    function App() {
      return (
        <div class="outer">
          <Deep />
          <span ref={(n) => logs.push({ tag: 'span', connected: n.isConnected })} />
        </div>
      )
    }
    mount(App)
    expect(logs).toEqual([
      { tag: 'button', connected: true },
      { tag: 'span', connected: true },
    ])
  })
})
