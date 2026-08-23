// ============================================================
// platform-diff 框架侧修复验收（PD-01/07/11/19/23/24/25）
// 运行：pnpm vitest run test/platform-diff.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  reactive,
  useId,
  renderToString
} from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'pd-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('PD-01/19：aria-*/data-* 布尔规范化', () => {
  it('true→"true"、false→"false" 不移除（React/ARIA 语义）', async () => {
    const state = reactive({ disabled: true })
    function App() {
      return <button aria-disabled={state.disabled} data-active={state.disabled} />
    }
    const host = mount(App)
    const btn = () => host.querySelector('button')!
    expect(btn().getAttribute('aria-disabled')).toBe('true')
    expect(btn().getAttribute('data-active')).toBe('true')

    state.disabled = false
    await flush()
    expect(btn().getAttribute('aria-disabled')).toBe('false') // 不移除
    expect(btn().getAttribute('data-active')).toBe('false')
  })

  it('null/undefined 移除', () => {
    function App() {
      return <button aria-disabled={undefined} data-x={null as any} />
    }
    const host = mount(App)
    expect(host.querySelector('button')!.getAttribute('aria-disabled')).toBeNull()
    expect(host.querySelector('button')!.getAttribute('data-x')).toBeNull()
  })

  it('SSR 输出 "true"/"false"', () => {
    const html = renderToString(<button aria-disabled={true} data-x={false} />)
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('data-x="false"')
  })
})

describe('PD-23：defaultValue/defaultChecked 走 property', () => {
  it('defaultValue 设置 el.defaultValue 而非无效 attribute', () => {
    function App() {
      return <input defaultValue="pre" />
    }
    const host = mount(App)
    const input = host.querySelector('input')!
    expect(input.defaultValue).toBe('pre')
    expect(input.getAttribute('defaultvalue')).toBeNull()
  })

  it('SSR 输出 value 属性（对齐 React）', () => {
    const html = renderToString(<input defaultValue="pre" />)
    expect(html).toContain('value="pre"')
  })
})

describe('PD-24：<component is> 剥离 is 键', () => {
  it('目标组件 props 不含 is', () => {
    let captured: any = null
    function Target(props: any) {
      captured = props
      return <span class="t">{props.msg}</span>
    }
    function App() {
      // @ts-expect-error msg 未在 props 参数声明：运行时 props 全量进 setup（is 被剥离）
      return <component is={Target} msg="hi" />
    }
    const host = mount(App)
    expect(host.querySelector('.t')!.textContent).toBe('hi')
    expect('is' in captured).toBe(false)
  })
})

describe('PD-25：style 对象支持 --* CSS 变量', () => {
  it('--* 走 setProperty，其余 camelCase 正常', () => {
    function App() {
      return <div class="box" style={{ '--gap': '8px', color: 'red' }} />
    }
    const host = mount(App)
    const box = host.querySelector('.box') as HTMLElement
    expect(box.style.getPropertyValue('--gap')).toBe('8px')
    expect(box.style.color).toBe('red')
  })
})

describe('PD-11：useId 稳定唯一', () => {
  it('重渲染间稳定、组件间唯一（setup 只执行一次）', async () => {
    const state = reactive({ n: 0 })
    const seen = new Set<string>()
    function Child(props: any) {
      const id = useId()
      seen.add(id)
      return <label for={id}>{props.n}</label>
    }
    function App() {
      return (
        <div>
          <Child n={state.n} />
          <Child n={state.n} />
        </div>
      )
    }
    const host = mount(App)
    const ids = () =>
      Array.from(host.querySelectorAll('label')).map((l) =>
        l.getAttribute('for'),
      )
    const before = ids()
    expect(before[0]).toMatch(/^actview-id-/)
    expect(before[0]).not.toBe(before[1]) // 唯一

    state.n = 1
    await flush()
    expect(ids()).toEqual(before) // 重渲染间稳定
    expect(seen.size).toBe(2) // useId 只在 setup 调用一次
  })

  it('SSR 输出 id', () => {
    function App() {
      const id = useId()
      return <label for={id}>x</label>
    }
    const html = renderToString(<App />)
    expect(html).toContain('for="actview-id-')
  })
})

describe('PD-07：裸函数组件运行时兜底', () => {
  it('函数返回 render 函数 → 正常挂载（手动 setup 风格）', () => {
    // 小写变量名：不经 babel 插件转换，保留为裸函数（setup 只执行一次）
    const raw = function () {
      const state = reactive({ msg: 'ok' })
      return () => <span class="raw">{state.msg}</span>
    }
    const host = mount(raw)
    expect(host.querySelector('.raw')!.textContent).toBe('ok')
  })

  it('函数返回 VNode（融合式）→ 明确报错而非 InvalidCharacterError', () => {
    const bad = function () {
      return <span>bad</span> // 返回 VNode 而非 render 函数
    }
    expect(() => mount(bad)).toThrow(/必须返回 render 函数/)
  })
})
