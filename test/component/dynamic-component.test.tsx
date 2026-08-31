// ============================================================
// 动态组件 <component is> 切换（拆分自 test/verify.test.tsx 场景 14）
// 运行：pnpm exec vitest run test/component/dynamic-component.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, nextTick } from '@actview/core'

/** 创建带 id 的宿主元素并挂载组件 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 场景 14：动态组件
// ------------------------------------------------------------
describe('场景 14：插槽与动态组件', () => {
  it('动态组件 <component is> 切换', async () => {
    const state = reactive({ view: 'a' })
    function A() {
      return <span>CompA</span>
    }
    function B() {
      return <span>CompB</span>
    }
    function App() {
      return <div><component is={state.view === 'a' ? A : B} /></div>
    }
    const host = mount('#s14b', App)
    expect(collectText(host)).toContain('CompA')
    state.view = 'b'
    await nextTick()
    expect(collectText(host)).toContain('CompB')
    state.view = 'a'
    await nextTick()
    expect(collectText(host)).toContain('CompA')
  })
})