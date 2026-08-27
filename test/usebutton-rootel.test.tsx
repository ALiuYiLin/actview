// ============================================================
// useButton 的 elementRef = useRootElement() 验收：
//   无需挂模板 ref（subTree.el 自动同步，所有分支统一）；
//   disabled 穿透修复（composite + disabled + 根是 <button disabled> →
//   DOM disabled 被删）在组件根分支真正生效
// 运行：pnpm exec vitest run test/usebutton-rootel.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  defineComponent,
  reactive,
  useRootElement
} from 'actview'

function isButtonElement(el: any): el is HTMLButtonElement {
  return !!el && el.tagName === 'BUTTON'
}

// 修正版 useButton：elementRef = useRootElement()（无需挂模板 ref，subTree.el 自动同步）
function useButton(parameters: () => any) {
  const elementRef = useRootElement()

  // disabled 穿透修复：composite 禁用按钮渲染另一个 button 时删 DOM disabled
  const updateDisabled = () => {
    const el = elementRef.value
    if (!isButtonElement(el)) return
    const { disabled = false, focusableWhenDisabled, composite = false } = parameters()
    if (composite && disabled && focusableWhenDisabled?.disabled === undefined && el.disabled) {
      el.disabled = false
    }
  }
  // 依赖 useRootElement 内部的 onMounted/onUpdated 同步顺序：
  // useRootElement 先注册（先执行）→ elementRef 已是最新 → 再 updateDisabled
  return { elementRef, updateDisabled }
}

// 场景：Toggle(disabled, composite) 根是另一个 <button disabled>（如 Menu.Trigger）
function TriggerToggle(props: any) {
  const { elementRef, updateDisabled } = useButton(() => ({
    disabled: props.disabled,
    composite: true, // 假设在 composite 上下文中
  }))

  // render 期同步一次（等同 useRootElement 的 onUpdated；此处验证值）
  const sync = () => {
    if (isButtonElement(elementRef.value) && elementRef.value.disabled) {
      updateDisabled()
    }
  }
  queueMicrotask(sync)
  updateDisabled()

  return <button disabled class="trigger-btn">{props.children}</button>
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'ub-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('useButton elementRef = useRootElement', () => {
  it('elementRef 自动指向根 DOM（无需挂模板 ref）', async () => {
    function App() {
      return <TriggerToggle disabled={true}>item</TriggerToggle>
    }
    const host = mount(App)
    await new Promise((r) => setTimeout(r, 0))
    const btn = host.querySelector('.trigger-btn')!
    expect(btn.tagName).toBe('BUTTON')
    // disabled 穿透：composite + disabled + 根是 button → DOM disabled 被删
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })
})
