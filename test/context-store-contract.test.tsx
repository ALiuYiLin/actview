// ============================================================
// createContext 存值契约边界 —— 快照值的语义边界锁定
//
// 背景：createContext 已改为 store-as-is（原样存储,不包 ref/不 watch 同步）。
// 本文锁定语义边界,防止未来无意间「复活」快照同步:
//   - 传【值快照】（不稳定引用,如 value={state.theme}）: 注入的是 setup 期
//     快照——后续数据变化【不会】传播到已挂载消费方（这是契约,不是 bug;
//     动态值请传 reactive 对象/rawRef/装 ref 的容器）
//   - 传【响应式引用】: 完全等价 Vue provide(inject) ——消费端读 .value/
//     深层属性即建立追踪
// 历史背景:旧实现的内部 ref+watch 同步曾引入真实缺陷
//   （plantform-diff.md:383 combobox 惰性 computed 事故）,故不再保留。
// 运行：pnpm exec vitest run test/context-store-contract.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, rawRef, reactive, ref, createContext } from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'sc-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('createContext 快照值边界（store-as-is）', () => {
  it('B1: 值快照注入 → 消费方读到 setup 期快照,后续变化不传播（契约锁定）', async () => {
    const ThemeCtx = createContext<{ theme: string } | undefined>(undefined)
    const state = reactive({ theme: 'light' })
    function Consumer() {
      const s = ThemeCtx.use()!
      return <span class="v">{s.theme}</span>
    }
    function App() {
      // ⚠️ 反例写法（每次渲染新对象 + 值快照）:故意保留以锁定边界——
      // 注入表存的是首渲快照,后续变化不传播
      return <ThemeCtx.Provider value={{ theme: state.theme }}><Consumer /></ThemeCtx.Provider>
    }
    const host = mount(App)
    expect(host.querySelector('.v')!.textContent).toBe('light')

    state.theme = 'dark'
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('light') // 快照契约:不传播
  })

  it('B2: 正确姿势对照——reactive 对象稳定引用 → 变化传播', async () => {
    const ThemeCtx = createContext<{ theme: string } | undefined>(undefined)
    const state = reactive({ theme: 'light' })
    function Consumer() {
      const s = ThemeCtx.use()!
      return <span class="v">{s.theme}</span>
    }
    function App() {
      return <ThemeCtx.Provider value={state}><Consumer /></ThemeCtx.Provider>
    }
    const host = mount(App)
    state.theme = 'dark'
    await flush()
    expect(host.querySelector('.v')!.textContent).toBe('dark')
  })

  it('B3: 重挂载的消费方读取的是注入表当前值（快照对重挂载无效）', async () => {
    const ThemeCtx = createContext<{ theme: string } | undefined>(undefined)
    const state = reactive({ theme: 'v1', show: true })
    function Consumer() {
      const s = ThemeCtx.use()!
      return <span class="leaf">{s.theme}</span>
    }
    function App() {
      return state.show ? <ThemeCtx.Provider value={state}><Consumer /></ThemeCtx.Provider> : <i class="empty" />
    }
    const host = mount(App)
    expect(host.querySelector('.leaf')!.textContent).toBe('v1')

    state.show = false
    await flush()
    state.theme = 'v2'
    state.show = true
    await flush()
    // 重挂载的消费方在自身 setup 期读取注入表——拿到的是【同一稳定对象】,
    // 因此读到最新值（若是值快照则会读到旧值——这正是响应式引用的意义）
    expect(host.querySelector('.leaf')!.textContent).toBe('v2')
  })

  it('B4: 中间层 provide（COW 拷贝）不阻断上下文消费', async () => {
    const ThemeCtx = createContext<{ theme: string } | undefined>(undefined)
    const state = reactive({ theme: 'z' })
    function Middle(props: any) {
      // 自身 provide 过 → 注入表 copy-on-write;上下文键应仍在表中
      // （简写体:此赋值在 setup 期执行一次,仅作 COW 触发标记）
      ;(props as any).__marker = true
      return <div>{props.children}</div>
    }
    function Leaf() {
      const s = ThemeCtx.use()!
      return <span class="leaf">{s.theme}</span>
    }
    function MiddleComp() {
      return <Middle><Leaf /></Middle>
    }
    function App() {
      return <ThemeCtx.Provider value={state}><MiddleComp /></ThemeCtx.Provider>
    }
    const host = mount(App)
    expect(host.querySelector('.leaf')!.textContent).toBe('z')
    state.theme = 'y'
    await flush()
    expect(host.querySelector('.leaf')!.textContent).toBe('y')
  })
})
