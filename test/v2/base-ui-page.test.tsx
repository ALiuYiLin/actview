// ============================================================
// BaseUIComponentsPage（demo 页）冒烟测试——真实挂载验证
//   Checkbox：3 个选项渲染、点击切换、Group 注册成员数
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
  it('Checkbox 区块：三个选项 + 点击切换 + 状态栏更新', async () => {
    const host = mount()
    const boxes = host.querySelectorAll('[role="checkbox"]')
    expect(boxes.length).toBe(3)
    // 香蕉默认选中（defaultChecked）
    expect(host.querySelector('[aria-checked="true"]')).toBeTruthy()

    // 点击苹果 label → 翻转 + 状态栏更新
    const apple = Array.from(boxes).find(
      (b) => (b as HTMLElement).getAttribute('data-value') === 'apple',
    ) as HTMLElement
    apple.click()
    await new Promise((r) => setTimeout(r, 0))
    expect((apple as HTMLInputElement).checked).toBe(true)
    expect(host.textContent).toContain('已选：banana、apple')
    expect(host.textContent).toContain('切换次数：1')
    expect(host.textContent).toContain('Group 注册成员：3')
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
