// ============================================================
// ErrorBoundary 捕获子组件渲染错误（拆分自 test/verify.test.tsx 场景 15）
// 运行：pnpm exec vitest run test/component/error-boundary.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, nextTick, ErrorBoundary } from 'actview'

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
// 场景 15：ErrorBoundary
// ------------------------------------------------------------
describe('场景 15：错误边界 / Suspense / lazy / ref', () => {
  it('ErrorBoundary 捕获子组件渲染错误并显示 fallback', async () => {
    const state = reactive({ boom: false })
    function throwBoom() {
      throw new Error('boom!')
    }
    // 抛错放在 JSX 表达式内（render 期执行、被渲染 effect 跟踪）；
    // 组件函数体顶层是 setup 体（只执行一次），不会在更新时重跑
    function Broken() {
      return <span>{state.boom ? throwBoom() : 'ok'}</span>
    }
    function App() {
      return (
        <div>
          <ErrorBoundary fallback={<b>出错了</b>}>
            <Broken />
          </ErrorBoundary>
        </div>
      )
    }
    const host = mount('#s15a', App)
    expect(collectText(host)).toContain('ok')

    state.boom = true // 子组件渲染抛错 → 边界捕获并显示 fallback
    await nextTick()
    expect(collectText(host)).toContain('出错了')
    expect(collectText(host)).not.toContain('ok')
  })
})