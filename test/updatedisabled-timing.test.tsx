// ============================================================
// useButton updateDisabled 触发时机验收
//   场景 A：disabled 是 reactive 且 render 读取 → 变化触发重渲染 → onUpdated 覆盖
//   场景 B：disabled 是 ref 且 render 不读取 → 变化不触发重渲染 → watch(parameters) 兜底
// 运行：pnpm exec vitest run test/updatedisabled-timing.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  defineComponent,
  reactive,
  ref,
  watch,
  onMounted,
  onUpdated,
  useRootElement
} from 'actview'

function isButtonElement(el: any): el is HTMLButtonElement {
  return !!el && el.tagName === 'BUTTON'
}

// 推荐模式：onMounted + onUpdated + watch(parameters, flush:'post') 兜底（幂等双保险）
function useButton(parameters: () => any) {
  const elementRef = useRootElement()

  const updateDisabled = () => {
    const el = elementRef.value
    if (!isButtonElement(el)) return
    const { disabled = false, composite = false } = parameters()
    // composite 禁用项：DOM disabled 属性删除（可聚焦穿透）
    if (composite && disabled && el.disabled) {
      el.disabled = false
    }
  }
  onMounted(updateDisabled)
  onUpdated(updateDisabled)
  // 兜底：render 未读取的响应式依赖变化 → watch 触发（post：组件更新后，elementRef 已新）
  watch(parameters, () => updateDisabled(), { flush: 'post' })

  return { updateDisabled, elementRef }
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'ud-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('updateDisabled 触发时机', () => {
  it('场景 A：render 读取 disabled → 重渲染 → onUpdated 覆盖（换渲染值也重新修复）', async () => {
    const state = reactive({ disabled: true, n: 0 })
    function App() {
      const { updateDisabled } = useButton(() => ({
        disabled: state.disabled,
        composite: true,
      }))
      return (
        <button class="a-btn" disabled onClick={updateDisabled}>
          {state.n}
        </button>
      )
    }
    const host = mount(App)
    const btn = () => host.querySelector('.a-btn') as HTMLButtonElement
    expect(btn().disabled).toBe(false) // 挂载即修复

    // 模拟后续渲染又带上 disabled，然后 render 读取的值变化 → 重渲染 → onUpdated 再修复
    btn().disabled = true
    state.n = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(btn().disabled).toBe(false)
  })

  it('场景 B：disabled 是纯 ref 且 render 不读取 → 无重渲染 → watch 兜底', async () => {
    const disabledRef = ref(false) // 初始 false：不修复（DOM disabled 保留）
    function App() {
      const { updateDisabled } = useButton(() => ({
        disabled: disabledRef.value,
        composite: true,
      }))
      // render 不读 disabledRef（只读一个无关 label）
      const label = ref('x')
      return (
        <button class="b-btn" disabled onClick={updateDisabled}>
          {label.value}
        </button>
      )
    }
    const host = mount(App)
    const btn = () => host.querySelector('.b-btn') as HTMLButtonElement
    expect(btn().disabled).toBe(true) // disabled=false → 不修复，保留 DOM disabled

    // 纯 ref 变化：render 不读 → 不重渲染 → onUpdated 不会跑 → watch 兜底
    disabledRef.value = true
    await new Promise((r) => setTimeout(r, 0))
    expect(btn().disabled).toBe(false) // watch 触发修复
  })
})
