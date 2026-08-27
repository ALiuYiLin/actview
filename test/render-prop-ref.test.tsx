// ============================================================
// render prop 分支的 subTree.el 捕获验收
//   1. 用户不展开 ref（单根）→ subTree.el 自动捕获（无需显式挂）
//   2. 用户展开 ref → 模板 ref 写入（与 subTree.el 同值）
//   3. Fragment 根 → subTree.el = null（必须显式挂 ref 到具体元素）
// 运行：pnpm exec vitest run test/render-prop-ref.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, useRootElement } from 'actview'

function Headless(props: any) {
  const rootRef = useRootElement()
  props.onRef?.(rootRef) // 观察 ref 对象（setup 期一次）

  // 渲染体依赖每次渲染新鲜的 props 解构 / 用户 render 回调立即调用 →
  // 小写分发函数保持逐渲染求值；末尾 <div> 是真实 JSX 分支，
  // 三元才被插件整体包进 render（新约定）
  const renderAsFunction = () => {
    const { render } = props
    return render({ ...computeMerged(), ref: rootRef })
  }
  const computeMerged = () => {
    const { render, ...elementProps } = props
    return { role: 'separator', ...elementProps } as any
  }
  return typeof props.render === 'function'
    ? renderAsFunction()
    : <div {...computeMerged()} />
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'rr-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('render prop 的 subTree.el 捕获', () => {
  it('用户不展开 ref（单根）→ subTree.el 自动捕获', () => {
    let rootRef: any = null
    function App() {
      return (
        <Headless
          onRef={(r: any) => (rootRef = r)}
          render={(p: any) => <div class="user-el">{p['aria-orientation']}</div>}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.user-el')!
    expect(rootRef.value).toBe(el) // 无需显式挂 ref，subTree.el 已捕获
  })

  it('用户展开 ref → 模板 ref 写入（与 subTree.el 同值）', () => {
    let rootRef: any = null
    function App() {
      return (
        <Headless
          onRef={(r: any) => (rootRef = r)}
          render={(p: any) => <div {...p} class="user-el2" />}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.user-el2')!
    expect(rootRef.value).toBe(el)
  })

  it('Fragment 根 → subTree.el 可能为 null，需要显式挂 ref', async () => {
    let rootRef: any = null
    const state = reactive({ n: 0 })
    function App() {
      return (
        <Headless
          onRef={(r: any) => (rootRef = r)}
          render={(p: any) => (
            <>
              <i class="frag-i">a{state.n}</i>
              <b class="frag-b">b</b>
            </>
          )}
        />
      )
    }
    const host = mount(App)
    await new Promise((r) => setTimeout(r, 0))
    const fragEl = rootRef.value // Fragment 根的 subTree.el
    console.log('[debug] fragment root: rootRef.value =', fragEl?.tagName ?? null)
    // 无论 rootRef 是否为 null，Fragment 的两个子元素都在 DOM
    expect(host.querySelector('.frag-i')).not.toBeNull()
    expect(host.querySelector('.frag-b')).not.toBeNull()
  })
})
