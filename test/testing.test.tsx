// ============================================================
// @actview/testing 测试工具验收测试（vitest + happy-dom）
//   覆盖：render 查询辅助 / fireEvent / waitFor / screen / cleanup
// 运行：pnpm test
// ============================================================

import { describe, it, expect, afterEach } from 'vitest'
import { reactive } from 'actview'
import { render, fireEvent, waitFor, screen, cleanup } from '@actview/testing'

afterEach(cleanup)

describe('@actview/testing', () => {
  it('render 返回查询辅助：getByText / getByClass / getByTestId', () => {
    function App() {
      return (
        <div class="app" data-testid="root">
          <span class="label">hello</span>
          <button class="btn">click me</button>
        </div>
      )
    }
    const { getByText, getByClass, getByTestId, queryByText } = render(App)
    expect(getByText('hello')).not.toBeNull()
    expect(getByClass('btn')).not.toBeNull()
    expect(getByTestId('root')).not.toBeNull()
    expect(queryByText('不存在')).toBeNull() // query 不抛错
  })

  it('getByText 找不到时抛错', () => {
    function App() {
      return <div>only</div>
    }
    const { getByText } = render(App)
    expect(() => getByText('missing')).toThrow()
  })

  it('fireEvent 触发点击事件，响应式更新', async () => {
    function Counter() {
      const state = reactive({ count: 0 })
      return (
        <button class="btn" onClick={() => state.count++}>
          count: {state.count}
        </button>
      )
    }
    const { getByClass, getByText } = render(Counter)
    expect(getByText('count: 0')).not.toBeNull()

    fireEvent(getByClass('btn'), 'click')
    await waitFor(() => expect(getByText('count: 1')).not.toBeNull())
  })

  it('fireEvent input 带 value 更新受控输入', async () => {
    function Form() {
      const state = reactive({ name: '' })
      return (
        <input
          class="ipt"
          value={state.name}
          onInput={(e: any) => (state.name = e.target.value)}
        />
      )
    }
    const { getByClass } = render(Form)
    const input = getByClass('ipt') as HTMLInputElement

    fireEvent(input, 'input', { value: 'actview' })
    await waitFor(() =>
      expect((getByClass('ipt') as HTMLInputElement).value).toBe('actview')
    )
  })

  it('screen 全局查询（作用于最近 render）', () => {
    function A() {
      return <div class="a-box">A content</div>
    }
    function B() {
      return <div class="b-box">B content</div>
    }
    render(A)
    render(B) // 最近 render 是 B
    expect(screen.getByText('B content')).not.toBeNull()
    expect(screen.queryByText('A content')).toBeNull() // screen 只作用于最近 render
  })

  it('cleanup 卸载全部组件', () => {
    function App() {
      return <div class="x">x</div>
    }
    render(App)
    expect(document.querySelector('.x')).not.toBeNull()
    cleanup()
    expect(document.querySelector('.x')).toBeNull()
  })
})
