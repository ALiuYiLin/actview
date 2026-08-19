// ============================================================
// 无头组件库 render-prop 模式验收（默认实现 + 用户可覆盖）
//   render prop 是普通函数 prop（不经 defineComponent 转换），
//   返回 VNode；render prop 内读响应式状态 → 追踪调用方 render effect
// 运行：pnpm exec vitest run test/render-prop.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp } from 'actview'

function Child(props: any) {
  return !props.render ? <div class="default"></div> : <>{props.render({})}</>
}

describe('render prop runtime', () => {
  it('render prop 覆盖默认实现', () => {
    const host = document.createElement('div')
    host.id = 'rp-host'
    document.body.appendChild(host)
    function App() {
      return (
        <div>
          <Child render={() => <div class="reChild"></div>}></Child>
        </div>
      )
    }
    createApp(App).mount('#rp-host')
    expect(host.querySelector('.reChild')).not.toBeNull()
    expect(host.querySelector('.default')).toBeNull()
  })

  it('无 render prop 时用默认实现', () => {
    const host = document.createElement('div')
    host.id = 'rp-host2'
    document.body.appendChild(host)
    function App() {
      return (
        <div>
          <Child />
        </div>
      )
    }
    createApp(App).mount('#rp-host2')
    expect(host.querySelector('.default')).not.toBeNull()
  })

  it('render prop 内读响应式状态 → 自动重渲染', async () => {
    const host = document.createElement('div')
    host.id = 'rp-host3'
    document.body.appendChild(host)
    const { reactive } = await import('actview')
    function App() {
      const state = reactive({ n: 0 })
      return (
        <div>
          <Child render={() => <div class="reChild">{state.n}</div>}></Child>
          <button class="inc" onClick={() => state.n++}></button>
        </div>
      )
    }
    createApp(App).mount('#rp-host3')
    expect(host.querySelector('.reChild')!.textContent).toBe('0')
    ;(host.querySelector('.inc') as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.reChild')!.textContent).toBe('1')
  })
})
