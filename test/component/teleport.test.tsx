// ============================================================
// Teleport 传送门（拆分自 test/verify.test.tsx 场景 23）
// 运行：pnpm exec vitest run test/component/teleport.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, nextTick, Teleport } from 'actview'

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
// 场景 23：Teleport
// ------------------------------------------------------------
describe('场景 23：Teleport / Transition', () => {
  it('Teleport：children 渲染到目标容器，卸载时移除', async () => {
    const target = document.createElement('div')
    target.id = 'tele-target'
    document.body.appendChild(target)

    const state = reactive({ show: true })
    function App() {
      return (
        <div id="t-app">
          {state.show ? (
            <Teleport to="#tele-target">
              <span class="tele-item">传送到目标</span>
            </Teleport>
          ) : null}
        </div>
      )
    }
    const host = mount('#s23a', App)

    // 源码位置无内容，目标容器有内容
    expect(host.querySelector('.tele-item')).toBeNull()
    expect(target.querySelector('.tele-item')?.textContent).toBe('传送到目标')

    state.show = false
    await nextTick()
    expect(target.querySelector('.tele-item')).toBeNull()
  })

  it('Teleport：to 切换迁移 DOM 到新目标', async () => {
    const t1 = document.createElement('div')
    t1.id = 'tele-t1'
    const t2 = document.createElement('div')
    t2.id = 'tele-t2'
    document.body.appendChild(t1)
    document.body.appendChild(t2)

    const state = reactive({ target: '#tele-t1' })
    function App() {
      return (
        <Teleport to={state.target}>
          <span class="tele-move">移动</span>
        </Teleport>
      )
    }
    mount('#s23b', App)
    expect(t1.querySelector('.tele-move')).not.toBeNull()

    state.target = '#tele-t2'
    await nextTick()
    expect(t1.querySelector('.tele-move')).toBeNull()
    expect(t2.querySelector('.tele-move')).not.toBeNull()
  })
})