// ============================================================
// <Provider value={ref…}> 的传递通道 —— store-as-is 契约下的 ref 研究
//
// 背景：createContext 已改 store-as-is（原样存储）。旧版「内部 ref + watch
// 同步 props.value」的接力机制已移除——本文验证新契约下 ref 的正确传递通道:
//   ⚠️ value={count}（顶层 ref）会被 jsxFactory 的 unwrapProps 解包成值快照
//      → 注入的是数字,不具响应性（jsxFactory 通用行为,非 context 特有）
//   ✅ value={rawRef(count)} —— rawRef 绕过解包,ref 本体直达注入表,
//      消费端 .value 活读;且 Host 不再被卷入（无接力,渲染计数不涨）
//   ✅ value={{ count }} —— 对象携带（顶层解包不深入对象）,同样活
// 对照研究（旧接力行为）:git 历史 feat/slot 分支之前的 context-ref-unwrap 版本。
// 运行：pnpm exec vitest run test/context-ref-unwrap.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, ref, rawRef, createContext, type Ref } from '@actview/core'

const NumCtx = createContext<Ref<number> | undefined>(undefined)
const ObjCtx = createContext<Ref<{ k: { n: number } }> | undefined>(undefined)

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'cru-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

function NumConsumer() {
  const r = NumCtx.use()!
  return <span class="cons">{String(r.value)}</span>
}

describe('Provider value 传 ref 的通道（store-as-is）', () => {
  it('T1: rawRef 直传 → 消费端 .value 活读,Host 渲染计数不涨（零接力）', async () => {
    const count = ref(0)
    let hostRenders = 0

    function Host() {
      return (
        <NumCtx.Provider value={rawRef(count)}>
          {/* Host render 不读 count → 不被追踪 */}
          {(() => {
            hostRenders++
            return ''
          })()}
          <NumConsumer />
        </NumCtx.Provider>
      )
    }

    const host = mount(Host)
    expect(host.querySelector('.cons')!.textContent).toBe('0')
    const rendersBefore = hostRenders

    count.value = 42
    await flush()

    expect(host.querySelector('.cons')!.textContent).toBe('42')
    expect(hostRenders).toBe(rendersBefore) // 零接力:Host 完全不参与
  })

  it('T2: 对象携带 ref → 注入表中的 ref 本体与原始 ref 同一（引用保真）', async () => {
    const count = ref(7)
    let injectedCount: any = null

    function Probe() {
      const bag = NumCtx.use()!
      injectedCount = bag.count
      return <i class="probe">{String(bag.count.value)}</i>
    }
    function Host() {
      return <NumCtx.Provider value={{ count }}><Probe /></NumCtx.Provider>
    }

    const host = mount(Host)
    expect(host.querySelector('.probe')!.textContent).toBe('7')
    expect(injectedCount).toBe(count) // 同一 ref 本体（对象携带不解包）
    injectedCount.value = 99
    expect(count.value).toBe(99) // 写透
    await flush()
    expect(host.querySelector('.probe')!.textContent).toBe('99')
  })

  it('T3: rawRef 携带对象 → 深层属性更新直达消费方（Host 不重渲染）', async () => {
    const state = ref({ k: { n: 1 } })
    let hostRenders = 0

    function ObjConsumer() {
      const ctx = ObjCtx.use()!
      return <b class="objc">{String(ctx.value.k.n)}</b>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={rawRef(state)}>
          {(() => {
            hostRenders++
            return ''
          })()}
          <ObjConsumer />
        </ObjCtx.Provider>
      )
    }

    const host = mount(Host)
    expect(host.querySelector('.objc')!.textContent).toBe('1')
    const rendersBefore = hostRenders

    state.value.k.n = 100
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('100')
    expect(hostRenders).toBe(rendersBefore) // Host 不参与
  })

  it('T4: rawRef 对象整体替换 → 消费方拿到新对象', async () => {
    const state = ref({ k: { n: 1 } })

    function ObjConsumer() {
      const ctx = ObjCtx.use()!
      return <em class="objc">{String(ctx.value.k.n)}</em>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={rawRef(state)}>
          <ObjConsumer />
        </ObjCtx.Provider>
      )
    }

    const host = mount(Host)
    expect(host.querySelector('.objc')!.textContent).toBe('1')

    state.value = { k: { n: 9 } }
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('9')
  })

  it('T5: 消费端经注入 ref 写深层属性与原始 ref 等效（同一存储）', async () => {
    const state = ref({ k: { n: 5 } })
    let injected: any = null

    function ObjConsumer() {
      const ctx = ObjCtx.use()!
      injected = ctx
      return <u class="objc">{String(ctx.value.k.n)}</u>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={rawRef(state)}>
          <ObjConsumer />
        </ObjCtx.Provider>
      )
    }

    const host = mount(Host)

    // 经注入的 ref 写深层属性 → 底层同一 reactive 存储
    injected.value.k.n = 555
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('555')
    expect(state.value.k.n).toBe(555)
  })
})
