// ============================================================
// P2-3 + 7.2：受控输入机制改进 + select/textarea 归一
//   渲染提交兜底还原（非事件场景）、toString 归一、select value→selected、
//   textarea children→value、hydrate 不覆盖用户输入
// 运行：pnpm exec vitest run test/platform-diff/controlled-form.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, renderToString } from '@actview/core'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'cf-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// select：value → option selected（单值 / multiple 数组）
// ------------------------------------------------------------
describe('P2-3：select 受控值', () => {
  it('单值：value 对应 option selected；切换受控值生效', async () => {
    const selected = ref('b')
    function App() {
      return (
        <select value={selected.value}>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
      )
    }
    const host = mount(App)
    const sel = host.querySelector('select') as HTMLSelectElement
    expect(sel.value).toBe('b')
    expect((sel.options[1] as HTMLOptionElement).selected).toBe(true)

    selected.value = 'a'
    await flush()
    expect(sel.value).toBe('a')
    expect((sel.options[0] as HTMLOptionElement).selected).toBe(true)
    expect((sel.options[1] as HTMLOptionElement).selected).toBe(false)
  })

  it('multiple + 数组：多项 selected', () => {
    function App() {
      return (
        <select multiple value={['a', 'c']}>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      )
    }
    const host = mount(App)
    const sel = host.querySelector('select') as HTMLSelectElement
    expect((sel.options[0] as HTMLOptionElement).selected).toBe(true)
    expect((sel.options[1] as HTMLOptionElement).selected).toBe(false)
    expect((sel.options[2] as HTMLOptionElement).selected).toBe(true)
  })

  it('未匹配值：清空选中（对齐 select.value 未知值表现）', () => {
    function App() {
      return (
        <select value="zz">
          <option value="a">A</option>
        </select>
      )
    }
    const host = mount(App)
    const sel = host.querySelector('select') as HTMLSelectElement
    expect((sel.options[0] as HTMLOptionElement).selected).toBe(false)
    expect(sel.selectedIndex).toBe(-1)
  })
})

// ------------------------------------------------------------
// textarea：children → value（React 语义，不渲染文本节点）
// ------------------------------------------------------------
describe('P2-3：textarea children → value', () => {
  it('无 value prop：children 文本作为初始 value，不渲染文本节点', () => {
    function App() {
      return <textarea>{'hello world'}</textarea>
    }
    const host = mount(App)
    const ta = host.querySelector('textarea')!
    expect(ta.value).toBe('hello world')
    // children 不渲染为文本节点（React 语义）
    expect(ta.childNodes.length).toBe(0)
  })

  it('value prop 优先于 children', () => {
    function App() {
      return <textarea value="v-prop">children-text</textarea>
    }
    const host = mount(App)
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('v-prop')
  })

  it('SSR：children 输出为 value（文本直出）', () => {
    const html = renderToString(<textarea>ssr text</textarea>)
    expect(html).toContain('ssr text')
  })
})

// ------------------------------------------------------------
// 7.2：toString 归一（value={5} 不产生多余拉回/光标重置）
// ------------------------------------------------------------
describe('7.2：toString 归一', () => {
  it('value={5}：渲染后 DOM 为 "5"，渲染提交不反复拉回', async () => {
    const state = reactive({ n: 5, tick: 0 })
    function App() {
      return <input value={state.n} />
    }
    const host = mount(App)
    const input = host.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('5')
    // 无关渲染多次触发：flush 兜底比较 "5" === String(5)，不拉回（无多余写）
    state.tick++
    await flush()
    expect(input.value).toBe('5')
    state.tick++
    await flush()
    expect(input.value).toBe('5')
  })
})

// ------------------------------------------------------------
// 7.2：渲染提交兜底（非事件场景——脚本/自动填充改 DOM 也会被拉回）
// ------------------------------------------------------------
describe('7.2：渲染提交兜底还原', () => {
  it('脚本直接改 DOM value（模拟自动填充）→ 下次渲染 flush 后拉回', async () => {
    const state = reactive({ v: 'a', n: 0 })
    function App() {
      return (
        <div>
          <input value={state.v} />
          <span>{state.n}</span>
        </div>
      )
    }
    const host = mount(App)
    const input = host.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('a')

    // 模拟自动填充：不经框架直接改 DOM
    input.value = 'autofilled'
    expect(input.value).toBe('autofilled')
    // 触发一次渲染（渲染读取的无关状态变化）→ flush 兜底还原
    state.n++
    await flush()
    expect(input.value).toBe('a')
  })

  it('受控元素卸载后不再被还原（注册表清理）', async () => {
    const state = reactive({ show: true, v: 'a', n: 0 })
    function App() {
      return state.show ? <input value={state.v} /> : <span>gone</span>
    }
    const host = mount(App)
    const input = host.querySelector('input') as HTMLInputElement
    state.show = false
    await flush()
    expect(host.querySelector('input')).toBeNull()
    // 卸载后触发渲染：不抛错、无残留还原
    state.n++
    await flush()
    expect(host.querySelector('span')!.textContent).toBe('gone')
  })
})

// ------------------------------------------------------------
// 7.2：hydrate 不覆盖用户输入（React trackHydrated 语义）
// ------------------------------------------------------------
describe('7.2：hydrate 不覆盖用户输入', () => {
  it('hydrate 前用户输入保留，SSR 值不被写回', () => {
    function App() {
      return <input value="ssr-init" />
    }
    const host = document.createElement('div')
    host.id = 'cf-hydrate'
    document.body.appendChild(host)
    host.innerHTML = renderToString(<App />)
    const input = host.querySelector('input') as HTMLInputElement
    // 模拟用户在 hydrate 前输入
    input.value = 'user-typed'

    createApp(App).hydrate('#cf-hydrate')
    expect(input.value).toBe('user-typed') // 不覆盖
  })
})

// ------------------------------------------------------------
// radio 受控组：渲染正确 + state 同步后不被误拉回
// ------------------------------------------------------------
describe('P2-3：radio 受控组', () => {
  it('受控 checked 按组渲染；用户切换 + state 同步后一致（不误拉回）', async () => {
    const sel = reactive({ v: 'a' })
    function App() {
      return (
        <div>
          <input type="radio" name="g" checked={sel.v === 'a'} onchange={(e: any) => (sel.v = 'a')} />
          <input type="radio" name="g" checked={sel.v === 'b'} onchange={(e: any) => (sel.v = 'b')} />
        </div>
      )
    }
    const host = mount(App)
    const radios = Array.from(host.querySelectorAll('input[type="radio"]')) as HTMLInputElement[]
    expect(radios[0].checked).toBe(true)
    expect(radios[1].checked).toBe(false)

    // 模拟用户点选 B：DOM 互斥（A 取消、B 选中）+ state 同步
    radios[1].checked = true
    radios[0].checked = false
    sel.v = 'b'
    await flush()
    // 渲染后受控值已是 b：兜底不拉回（A 受控 false == DOM false）
    expect(radios[0].checked).toBe(false)
    expect(radios[1].checked).toBe(true)
  })
})
