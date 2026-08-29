// ============================================================
// P2-4：调度双层队列 + job 排序 + 递归检测
//   父先子后（job id 升序）、watch pre 在组件更新前、watch post 在
//   渲染提交后（DOM 已更新）、递归更新检测告警
//   渲染序标记用 onUpdated 钩子（update 后同步触发，简写 JSX 组件可注册）
// 运行：pnpm exec vitest run test/reactivity/scheduler-p2-4.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, onUpdated, reactive, watch } from 'actview'
import { queueJob, runEffect } from '../../packages/core/src/reactivity/reactive-system'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'sched-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// 父先子后（job id 升序，对齐 Vue findInsertionIndex）
// ------------------------------------------------------------
describe('P2-4：父组件先于子组件更新', () => {
  it('父子同时依赖同一状态：父 updated 先于子 updated', async () => {
    const log: string[] = []
    const state = reactive({ n: 0 })
    function Child() {
      onUpdated(() => log.push('child-updated'))
      return <span>{state.n}</span>
    }
    function Parent() {
      onUpdated(() => log.push('parent-updated'))
      return (
        <div>
          <i>{state.n}</i>
          <Child />
        </div>
      )
    }
    const host = mount(Parent)
    log.length = 0
    state.n++
    await flush()
    const firstParent = log.indexOf('parent-updated')
    const firstChild = log.indexOf('child-updated')
    expect(firstParent).toBeGreaterThanOrEqual(0)
    expect(firstChild).toBeGreaterThan(firstParent) // 父先子后
    expect(host.querySelector('span')!.textContent).toBe('1')
  })
})

// ------------------------------------------------------------
// watch pre / post 时序（双层队列）
// ------------------------------------------------------------
describe('P2-4：watch 双层队列时序', () => {
  it('watch pre（默认）：组件更新前执行', async () => {
    const log: string[] = []
    const state = reactive({ n: 0 })
    function App() {
      onUpdated(() => log.push('app-updated'))
      return <span>{state.n}</span>
    }
    const host = mount(App)
    watch(() => state.n, () => log.push('watch-pre'))
    log.length = 0
    state.n++
    await flush()
    expect(log).toEqual(['watch-pre', 'app-updated'])
  })

  it('watch post：渲染提交（DOM 已更新）后执行', async () => {
    const log: string[] = []
    const state = reactive({ n: 0 })
    function App() {
      onUpdated(() => log.push('app-updated'))
      return <span>{state.n}</span>
    }
    const host = mount(App)
    watch(
      () => state.n,
      () => log.push('watch-post:' + host.querySelector('span')!.textContent),
      { flush: 'post' },
    )
    log.length = 0
    state.n = 5
    await flush()
    expect(log).toEqual(['app-updated', 'watch-post:5'])
  })

  it('多次触发去重：同轮仅执行一次', async () => {
    const calls: number[] = []
    const state = reactive({ n: 0, m: 0 })
    watch(() => state.n + state.m, (v) => calls.push(v))
    state.n++
    state.m++
    await flush()
    expect(calls).toEqual([2]) // 一次（批处理去重）
  })
})

// ------------------------------------------------------------
// 递归更新检测
// ------------------------------------------------------------
describe('P2-4：递归更新检测', () => {
  it('effect 不断修改自身依赖：超阈值告警并跳过（不死循环）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const state = reactive({ n: 0 })
    // scheduler 参数即 effect 本身（trigger 调用 scheduler(effect)），
    // 无需闭包自引用（避免首次同步 run 时 TDZ）
    const effect = runEffect(
      () => {
        state.n++
      },
      { scheduler: (eff) => queueJob(eff) },
    )
    await flush()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('递归更新检测'))
    expect(state.n).toBeLessThanOrEqual(103) // 首 run + ~100 次后跳过
    warn.mockRestore()
  })
})
