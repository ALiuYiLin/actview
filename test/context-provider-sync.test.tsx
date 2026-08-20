// ============================================================
// createContext Provider watch 同步边界验收
//   场景 1：value 每次渲染新对象（引用不稳定）→ 消费方拿到新值
//   场景 2：value 引用稳定（reactive 原地改）→ 对照组
//   场景 3：消费方重挂载（key 变化）→ 读到最新 context
//   场景 4：Provider 值 + children 同时变 → 消费方重渲染
//   场景 5：Provider 条件移除重挂载（新 ref）+ 中间层 COW → 读新值
// 结论：watch(() => props.value) 追踪的是**同一个** props 代理（updateProps
//   原地写、不换代理）→ 引用不稳定/重挂载均无陈旧快照
// 运行：pnpm exec vitest run test/context-provider-sync.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  defineComponent,
  reactive,
  ref,
  createContext,
  provide
} from 'actview'

const MeterCtx = createContext<{ value: number } | undefined>(undefined)

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'cw-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

function Consumer(props: any) {
  const ctx = MeterCtx.use()
  const state = reactive({ v: -1 })
  // 渲染期读 .value → 追踪
  return () => {
    const v = ctx.value?.value
    if (v !== state.v) state.v = v
    return <span class="cons">{props.tag}-{String(state.v)}</span>
  }
}

describe('Provider watch 同步边界', () => {
  it('场景 1：value 每次渲染新对象（引用不稳定）→ 消费方拿到新值', async () => {
    const state = reactive({ n: 0 })
    let renders = 0
    function Host() {
      return () => {
        renders++
        // 每次渲染 NEW 对象（引用不稳定）
        return (
          <MeterCtx.Provider value={{ value: state.n }}>
            <Consumer tag="a" />
          </MeterCtx.Provider>
        )
      }
    }
    const host = mount(Host)
    expect(host.querySelector('.cons')!.textContent).toBe('a-0')
    state.n = 5
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.cons')!.textContent).toBe('a-5')
  })

  it('场景 2：value 引用稳定（reactive 原地改）→ 对照组', async () => {
    const ctxState = reactive({ value: 0 })
    function Host() {
      return () => (
        <MeterCtx.Provider value={ctxState}>
          <Consumer tag="b" />
        </MeterCtx.Provider>
      )
    }
    const host = mount(Host)
    expect(host.querySelector('.cons')!.textContent).toBe('b-0')
    ctxState.value = 7
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.cons')!.textContent).toBe('b-7')
  })

  it('场景 3：消费方重挂载（key 变化）→ 读到最新 context 值', async () => {
    const state = reactive({ n: 1, key: 'k1' })
    function Host() {
      return () => (
        <MeterCtx.Provider value={{ value: state.n }}>
          <Consumer key={state.key} tag="c" />
        </MeterCtx.Provider>
      )
    }
    const host = mount(Host)
    expect(host.querySelector('.cons')!.textContent).toBe('c-1')
    // 换 key → 消费方重挂载 + 值变化
    state.n = 9
    state.key = 'k2'
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.cons')!.textContent).toBe('c-9')
  })

  it('场景 4：Provider 值 + children 同时变化', async () => {
    const state = reactive({ n: 2, label: 'x' })
    function Host() {
      return () => (
        <MeterCtx.Provider value={{ value: state.n }}>
          <Consumer tag={state.label} />
        </MeterCtx.Provider>
      )
    }
    const host = mount(Host)
    expect(host.querySelector('.cons')!.textContent).toBe('x-2')
    state.n = 3
    state.label = 'y'
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.cons')!.textContent).toBe('y-3')
  })

  it('场景 5：Provider 条件移除后重挂载（新 ref 注入）+ 中间层 COW 过 → 消费方读到新值', async () => {
    const state = reactive({ show: true, n: 4 })
    function Leaf() {
      const ctx = MeterCtx.use()
      return () => <span class="leaf">{ctx.value?.value}</span>
    }
    function Middle() {
      // COW：提供过东西 → 注入表被拷贝
      provide('middle-marker', 'x')
      return () => <Leaf />
    }
    function Host() {
      return () => (
        <div>
          {state.show ? (
            <MeterCtx.Provider value={{ value: state.n }}>
              <Middle />
            </MeterCtx.Provider>
          ) : (
            <div class="empty" />
          )}
          <button class="tgl" onClick={() => (state.show = !state.show)} />
        </div>
      )
    }
    const host = mount(Host)
    expect(host.querySelector('.leaf')!.textContent).toBe('4')

    // 移除 → Provider+Middle+Leaf 卸载；改值；重新挂载 → 新 ref 注入
    state.show = false
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.leaf')).toBeNull()
    state.n = 8
    state.show = true
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.leaf')!.textContent).toBe('8') // 重挂后读新值
  })
})
