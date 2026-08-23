// ============================================================
// 验证：<Context.Provider><Child1/><Child2/></Context.Provider>
//   透传多根 children 时，Provider render 返回数组（props.children 为
//   多元素数组）——依赖 mountComponent update 里的「数组 → Fragment」
//   归一化。若某条路径漏归一化，mountVNode(数组) 会把数组当元素类型，
//   渲染出 <undefined> 占位。
// 运行：pnpm exec vitest run test/renderer/provider-multiroot.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, createContext, ref, nextTick } from 'actview'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'pm-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('Context.Provider 透传多根 children', () => {
  it('首渲：两个根节点都渲染，无 <undefined> 占位，且为兄弟节点', () => {
    const Ctx = createContext('d')
    function App() {
      return (
        <Ctx.Provider value="x">
          <div id="c1">C1</div>
          <span id="c2">C2</span>
        </Ctx.Provider>
      )
    }
    const host = mount(App)
    const c1 = host.querySelector('#c1')
    const c2 = host.querySelector('#c2')
    expect(c1).toBeTruthy()
    expect(c2).toBeTruthy()
    expect(c1!.parentNode).toBe(c2!.parentNode) // 兄弟（同父）
    expect(host.textContent).not.toContain('undefined')
  })

  it('更新：children 变化（多根 ↔ 单根）diff 正确、不产生占位', async () => {
    const Ctx = createContext('d')
    const multi = ref(true)
    function ChildA() {
      return <div id="c1">C1</div>
    }
    function ChildB() {
      return <span id="c2">C2</span>
    }
    function App() {
      return (
        <Ctx.Provider value="x">
          {multi.value ? [<ChildA key="a" />, <ChildB key="b" />] : <ChildA key="a" />}
        </Ctx.Provider>
      )
    }
    const host = mount(App)
    expect(host.querySelector('#c1')).toBeTruthy()
    expect(host.querySelector('#c2')).toBeTruthy()
    multi.value = false
    await nextTick()
    expect(host.querySelector('#c1')).toBeTruthy()
    expect(host.querySelector('#c2')).toBeNull() // 多根 → 单根
    expect(host.textContent).not.toContain('undefined')
    multi.value = true
    await nextTick()
    expect(host.querySelector('#c1')).toBeTruthy()
    expect(host.querySelector('#c2')).toBeTruthy()
  })

  it('更新：Provider value 变化触发透传 children 重渲（多根保持）', async () => {
    const Ctx = createContext('d')
    const v = ref('a')
    function App() {
      return (
        <Ctx.Provider value={v.value}>
          <div id="c1">C1</div>
          <span id="c2">C2</span>
        </Ctx.Provider>
      )
    }
    const host = mount(App)
    expect(host.querySelector('#c1')).toBeTruthy()
    expect(host.querySelector('#c2')).toBeTruthy()
    v.value = 'b'
    await nextTick()
    await nextTick()
    expect(host.querySelector('#c1')).toBeTruthy()
    expect(host.querySelector('#c2')).toBeTruthy()
    expect(host.textContent).not.toContain('undefined')
  })
})
