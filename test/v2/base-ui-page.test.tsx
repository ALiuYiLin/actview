// ============================================================
// BaseUIComponentsPage（demo 页）冒烟测试——真实挂载验证
//   Checkbox：Group 统管 value/onValueChange、Root 注册、Indicator、
//             点击切换、disabled、Group 注册成员数
//   Avatar：context 驱动的状态机（idle → loading → loaded）
// ============================================================
import { describe, expect, it } from 'vitest'
import { createApp } from 'actview'
import { BaseUIComponentsPage } from '../../src/pages/BaseUIComponentsPage'

function mount() {
  const host = document.createElement('div')
  createApp(BaseUIComponentsPage).mount(host)
  return host
}

describe('BaseUIComponentsPage demo 页', () => {
  it('Checkbox 区块：Group 统管 value + 点击切换 + 状态栏更新', async () => {
    const host = mount()
    // 三个 Root 的根 button（role="checkbox" 挂在默认 button 根上）
    const boxes = host.querySelectorAll('[role="checkbox"]')
    expect(boxes.length).toBe(3)
    // Group 根 div 透传 className / aria-label
    const group = host.querySelector('.demo-checkbox-group')
    expect(group?.getAttribute('aria-label')).toBe('水果多选')
    // 香蕉受控预置选中（value 初始 ['banana']）→ aria-checked + Indicator
    expect(host.querySelector('[aria-checked="true"]')).toBeTruthy()
    expect(host.querySelector('[data-checked="true"]')).toBeTruthy()

    // 点击苹果根 button → 翻转 + 状态栏更新
    const apple = Array.from(boxes).find(
      (b) => (b as HTMLElement).getAttribute('data-value') === 'apple',
    ) as HTMLElement
    apple.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(apple.getAttribute('aria-checked')).toBe('true')
    // CheckboxRoot 内部同步写隐藏 input.checked（② 内部 ref 的读/写）
    const hiddenInput = host.querySelector(
      'input[aria-hidden="true"]',
    ) as HTMLInputElement | null
    expect(hiddenInput?.checked).toBe(true)
    expect(host.textContent).toContain('已选：banana、apple')
    expect(host.textContent).toContain('切换次数：1')
    expect(host.textContent).toContain('Group 注册成员：3')

    // disabled 的樱桃点击不翻转、不上报
    const cherry = Array.from(boxes).find(
      (b) => (b as HTMLElement).getAttribute('data-value') === 'cherry',
    ) as HTMLElement
    cherry.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(cherry.getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('切换次数：1')
  })

  it('Avatar 区块：context 驱动状态机 idle → loading → loaded', async () => {
    const host = mount()
    const avatar = host.querySelector('.avatar-demo') as HTMLElement
    expect(avatar).toBeTruthy()
    // 初始 idle
    expect(avatar.getAttribute('data-status')).toBe('idle')
    // 挂载后子部件 setImageLoadingStatus('loading') → 500ms 后 'loaded'
    await new Promise((r) => setTimeout(r, 50))
    expect(avatar.getAttribute('data-status')).toBe('loading')
    await new Promise((r) => setTimeout(r, 600))
    expect(avatar.getAttribute('data-status')).toBe('loaded')
  })
})
