// ============================================================
// EffectScope 自动停止测试（拆分自 verify.test.tsx + p0.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/effect-scope.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, ref, computed, watch, nextTick, createApp, effectScope, onScopeDispose } from 'actview'

/** 创建带 id 的宿主元素并挂载组件——拆分自 verify.test.tsx L15-21 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点）——拆分自 verify.test.tsx L24-28 */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 以下 describe 拷贝自 verify.test.tsx — 场景 21：EffectScope 自动停止（L1194-1252，2 用例）
// ------------------------------------------------------------
describe('场景 21：EffectScope 自动停止', () => {
  it('组件卸载后 watch 自动停止（回调不再触发）', async () => {
    const state = reactive({ n: 0 })
    const log: string[] = []
    const ui = reactive({ on: true })
    function Child() {
      watch(() => state.n, (v) => log.push(`child:${v}`))
      return <span>child</span>
    }
    function App() {
      return <div>{ui.on ? <Child /> : null}</div>
    }
    const host = mount('#s21a', App)

    state.n = 1
    await nextTick()
    expect(log).toEqual(['child:1']) // 挂载期间 watch 生效

    ui.on = false // 卸载 Child → scope.stop → watch 自动停止
    await nextTick()
    state.n = 2
    await nextTick()
    expect(log).toEqual(['child:1']) // 不再触发（修复前会追加 'child:2'）
  })

  it('computed 随组件卸载停止重算；组件外 watch 不受影响', async () => {
    const state = reactive({ n: 1 })
    let computedRuns = 0
    const externalWatchLog: number[] = []
    // 组件外 watch：不绑定任何 scope，手动管理
    const stopExternal = watch(() => state.n, (v) => externalWatchLog.push(v))

    function Child() {
      const double = computed(() => {
        computedRuns++
        return state.n * 2
      })
      return <span>{double.value}</span>
    }
    const ui = reactive({ on: true })
    function App() {
      return <div>{ui.on ? <Child /> : null}</div>
    }
    const host = mount('#s21b', App)
    expect(collectText(host)).toContain('2')
    expect(computedRuns).toBe(1)

    ui.on = false // 卸载 Child：computed 的 effect 停止
    await nextTick()
    const runsAfterUnmount = computedRuns
    state.n = 10
    await nextTick()
    expect(computedRuns).toBe(runsAfterUnmount) // computed 不再重算

    await nextTick()
    expect(externalWatchLog).toContain(10) // 组件外 watch 仍生效（需手动 stop）
    stopExternal()
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 p0.test.tsx — P0: effectScope / onScopeDispose（L355-375，1 用例）
// v1 的 runEffect 是特有 API——「scope.stop 停止 effect 并执行 cleanup」用例移除
// （v2 的 effectScope 由 vue 提供，watchEffect/onScopeDispose 语义见 test/v2）
// ------------------------------------------------------------