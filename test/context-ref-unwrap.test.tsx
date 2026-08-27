// ============================================================
// <Context.Provider value={ref}> —— props 自动解包下的响应性验收
//
// 背景：jsxFactory.unwrapProps 在 JSX 表达式求值处（= 父组件 render effect
// 执行期间）对顶层 ref 读 .value 解包，因此：
//   <Provider value={refCount}> 实际传给 Provider 组件的是【当前数值】，
//   Provider 内部再用它新建独立 ref（context.tsx: ref(props.value ?? default)）
//   → 内部 ref ≠ 原始 refCount（双重包装，身份分离）。
//
// 待验证问题：之后修改原始 refCount.value 还有没有响应性？
// 已验证结论：
//   - 有响应性，但走「接力」路径而非直连（T1）：
//     解包读 .value 发生在 Host render effect 内 → track 到原始 ref
//     → count.value++ 触发 Host 重渲染 → 新值作为 props.value 同步进
//       Provider → watch(flush:'sync') 就地同步内部 ref → 消费方更新。
//   - 对象 ref 的【深层】mutation 则完全绕开上述链路（T3）：消费方在 render 里读
//     ctx.value.deepKey 时由 reactive proxy 直接 track 到消费方自己的
//     render effect，无需 Host 重渲染。
//
// 组件风格：本项目官方简写 `function X() { ...; return <JSX/> }` ——由
// @actview/plugin-vite 的 defineComponentPlugin 在 esbuild 之前编译为内部的
// defineComponent(setup → () => JSX)。运行时契约：__setup 必须返回渲染函数，
// 手动返回 VNode 会抛错（mountComponent「必须返回 render 函数」守卫）；
// 手写 return () => JSX 是已废弃的旧方案。render 次数统计用 JSX 内 IIFE
// 副作用表达（求值发生在 render effect 内）。
//
// 运行：pnpm exec vitest run test/context-ref-unwrap.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  ref,
  createContext,
  type Ref
} from 'actview'

const NumCtx = createContext(0)
const ObjCtx = createContext<{ k: { n: number } } | undefined>(undefined)

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

/** 极简消费者：render 里读 ctx.value 建立追踪 */
function NumConsumer() {
  const ctx = NumCtx.use()
  return <span class="cons">{String(ctx.value)}</span>
}

describe('Provider value 直接传 ref（自动解包场景）', () => {
  it('T1: 修改原始 refCount.value → 消费方仍更新（接力路径生效）+ Host 确实重渲染', async () => {
    const count = ref(0)
    let hostRenders = 0

    function Host() {
      return (
        <NumCtx.Provider value={count}>
          {/* 每次 render 求值一次：统计 Host 渲染次数 */}
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
    expect(rendersBefore).toBeGreaterThan(0)

    // 在任何 effect 之外修改原始 ref——考验「解包 + 接力」链路
    count.value = 42
    await flush()

    expect(host.querySelector('.cons')!.textContent).toBe('42')
    // 关键证据：Host 因为依赖了 refCount 而重渲染过（解包读取 track 到了它）
    expect(hostRenders).toBeGreaterThan(rendersBefore)
  })

  it('T2: 消费方拿到的内部 ref ≠ 原始 refCount（双重包装，身份分离）', async () => {
    const count = ref(7)
    let injected: Ref<number> | null = null

    function Probe() {
      const ctx = NumCtx.use()
      injected = ctx // setup 阶段捕获注入的 ref 本体
      return <i class="probe">{String(ctx.value)}</i>
    }
    function Host() {
      return (
        <NumCtx.Provider value={count}>
          <Probe />
        </NumCtx.Provider>
      )
    }

    const host = mount(Host)
    expect(host.querySelector('.probe')!.textContent).toBe('7')
    // 内部是 Provider 新建的 ref，不是传进来的那个：
    // 所以「往 ctx.value 写」不会影响原始 refCount（基本类型无共享存储）
    expect(injected).not.toBe(count)
    injected!.value = 99
    expect(count.value).toBe(7) // 原始 ref 不受写内部 ref 影响
    await flush() // 消费方更新走微任务队列，等一拍再断言 DOM
    expect(host.querySelector('.probe')!.textContent).toBe('99')
  })

  it('T3: 对象 ref 的深层 mutation → 消费方直接更新，Host 不重渲染（不经接力）', async () => {
    const state = ref({ k: { n: 1 } })
    let hostRenders = 0

    function ObjConsumer() {
      const ctx = ObjCtx.use()
      return <b class="objc">{String(ctx.value!.k.n)}</b>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={state}>
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

    // 深层修改走 reactive proxy set trap：消费方 render 读 k.n 时已直接
    // track 到自己的 render effect，不需要 Host 重渲染中转
    state.value.k.n = 100
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('100')
    expect(hostRenders).toBe(rendersBefore) // Host 完全没动——证明是直达路径
  })

  it('T4: 对象 ref 整体替换 value → Host 重渲染接力，消费方拿到新对象', async () => {
    const state = ref({ k: { n: 1 } })

    function ObjConsumer() {
      const ctx = ObjCtx.use()
      return <em class="objc">{String(ctx.value!.k.n)}</em>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={state}>
          <ObjConsumer />
        </ObjCtx.Provider>
      )
    }

    const host = mount(Host)
    expect(host.querySelector('.objc')!.textContent).toBe('1')

    // 整体换对象：只有 Host 的解包读取追踪到了这次替换
    state.value = { k: { n: 9 } }
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('9')
  })

  it('T5: 消费方经 ctx.value 修改深层属性与改原始 ref 等效（同一 reactive 存储）', async () => {
    const state = ref({ k: { n: 5 } })
    let injected: any = null

    function ObjConsumer() {
      const ctx = ObjCtx.use()
      injected = ctx // setup 阶段捕获注入的 ref 本体
      return <u class="objc">{String(ctx.value!.k.n)}</u>
    }
    function Host() {
      return (
        <ObjCtx.Provider value={state}>
          <ObjConsumer />
        </ObjCtx.Provider>
      )
    }

    const host = mount(Host)

    // 经内部 ref 的代理写 → 底层 target 与原始 ref 相同（reactiveMap 幂等）
    injected.value.k.n = 555
    await flush()

    expect(host.querySelector('.objc')!.textContent).toBe('555')
    expect(state.value.k.n).toBe(555) // 原始 ref 看到同一份变化
  })
})
