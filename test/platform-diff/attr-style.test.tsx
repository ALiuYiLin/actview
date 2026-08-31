// ============================================================
// P0：属性/样式规范化修复验收（C7/C2/C11 + enumerated + class 合并）
//   C7  : style undefined/null/false 不输出（两端一致）
//   C2  : 数字样式补 px（unitless/0/CSS 变量边界）
//   C11 : 布尔属性客户端 attribute+property、false 重置 property
//   enumerated : contenteditable/draggable/spellcheck true→"true" false→"false"
//   class : 数组/对象条件合并（两端）
// 运行：pnpm exec vitest run test/platform-diff/attr-style.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, renderToString } from '@actview/core'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'attr-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// C7：style undefined 值不过滤（SSR 曾输出 "k:undefined"）
// ------------------------------------------------------------
describe('C7：style undefined/null/false 过滤', () => {
  it('SSR：不输出 undefined/null/false 键', () => {
    const html = renderToString(
      <div style={{ writingMode: undefined, a: null as any, b: false } as any} />,
    )
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
    expect(html).not.toContain('a:')
    expect(html).not.toContain('b:')
    expect(html).toBe('<div></div>')
  })

  it('SSR：正常值仍输出', () => {
    const html = renderToString(<div style={{ color: 'red' }} />)
    expect(html).toContain('style="color:red"')
  })

  it('客户端：undefined/null/false 键不写入 style', () => {
    function App() {
      return (
        <div class="box" style={{ color: 'red', undef: undefined, nope: null as any, no: false } as any} />
      )
    }
    const host = mount(App)
    const box = host.querySelector('.box') as HTMLElement
    expect(box.style.cssText).toBe('color: red;')
    expect(box.style.getPropertyValue('undef')).toBe('')
  })
})

// ------------------------------------------------------------
// C2：数字样式补 px（SSR 曾输出 width:1 非法值）
// ------------------------------------------------------------
describe('C2：数字样式补 px（SSR）', () => {
  it('非 0 数字补 px：1→1px、-1→-1px', () => {
    const html = renderToString(
      <div style={{ width: 1, margin: -1 } as any} />,
    )
    expect(html).toContain('width:1px')
    expect(html).toContain('margin:-1px')
  })

  it('0 不补 px、unitless 不补、CSS 变量不补', () => {
    const html = renderToString(
      <div style={{ width: 0, opacity: 0.5, lineHeight: 1, flex: 1, '--x': 1 } as any} />,
    )
    expect(html).toContain('width:0')
    expect(html).toContain('opacity:0.5')
    expect(html).toContain('lineHeight:1')
    expect(html).toContain('flex:1')
    expect(html).toContain('--x:1')
    expect(html).not.toContain('0px')
  })

  it('字符串值原样（带单位不重复补）', () => {
    const html = renderToString(<div style={{ width: '100%' }} />)
    expect(html).toContain('width:100%')
  })

  it('客户端：数字交给 CSSOM（width:1 → 1px）', () => {
    function App() {
      return <div class="box" style={{ width: 1, opacity: 0.5 } as any} />
    }
    const host = mount(App)
    const box = host.querySelector('.box') as HTMLElement
    expect(box.style.width).toBe('1px')
    expect(box.style.opacity).toBe('0.5')
  })
})

// ------------------------------------------------------------
// C11：布尔属性 attribute + property、false 重置
// ------------------------------------------------------------
describe('C11：布尔属性（checked/disabled/readonly）', () => {
  it('客户端：true → attribute 存在 + property 为 true（与 SSR 一致）', () => {
    function App() {
      return <input type="checkbox" checked disabled tabindex="-1" aria-hidden="true" />
    }
    const host = mount(App)
    const input = host.querySelector('input')!
    expect(input.getAttribute('checked')).toBe('')
    expect(input.getAttribute('disabled')).toBe('')
    expect(input.checked).toBe(true)
    expect(input.disabled).toBe(true)
  })

  it('客户端：checked true→false 重渲染 → property 重置 + attribute 移除', async () => {
    const state = reactive({ on: true })
    function App() {
      return <input type="checkbox" checked={state.on} />
    }
    const host = mount(App)
    const input = host.querySelector('input')!
    expect(input.checked).toBe(true)
    expect(input.getAttribute('checked')).toBe('')

    state.on = false
    await flush()
    expect(input.checked).toBe(false) // 状态残留修复
    expect(input.getAttribute('checked')).toBeNull()
  })

  it('客户端：disabled true→false → property 重置', async () => {
    const state = reactive({ on: true })
    function App() {
      return <button disabled={state.on}>x</button>
    }
    const host = mount(App)
    const btn = host.querySelector('button')!
    expect(btn.disabled).toBe(true)
    state.on = false
    await flush()
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('disabled')).toBeNull()
  })

  it('default* 不设 attribute（对齐 React，PD-23 回归）', () => {
    function App() {
      return <input defaultValue="pre" defaultChecked />
    }
    const host = mount(App)
    const input = host.querySelector('input')!
    expect(input.defaultValue).toBe('pre')
    expect(input.defaultChecked).toBe(true)
    expect(input.getAttribute('defaultvalue')).toBeNull()
    expect(input.getAttribute('defaultchecked')).toBeNull()
  })

  it('SSR：布尔 true 输出裸属性（不变）', () => {
    const html = renderToString(<input type="checkbox" checked disabled readonly={false} />)
    expect(html).toBe('<input type="checkbox" checked disabled>')
  })
})

// ------------------------------------------------------------
// enumerated：contenteditable/draggable/spellcheck 值映射
// ------------------------------------------------------------
describe('enumerated 属性值映射', () => {
  it('SSR：true→"true"、false→"false"', () => {
    const html = renderToString(<div contentEditable={true} draggable={false} spellCheck={true} />)
    expect(html).toContain('contenteditable="true"')
    expect(html).toContain('draggable="false"')
    expect(html).toContain('spellcheck="true"')
  })

  it('客户端：true→"true"、false→"false"（不移除）', () => {
    function App() {
      return <div class="ed" contentEditable={true} draggable={false} />
    }
    const host = mount(App)
    const el = host.querySelector('.ed')!
    expect(el.getAttribute('contenteditable')).toBe('true')
    expect(el.getAttribute('draggable')).toBe('false')
  })

  it('客户端：null 移除', () => {
    function App() {
      return <div class="ed" contentEditable={null as any} />
    }
    const host = mount(App)
    expect(host.querySelector('.ed')!.getAttribute('contenteditable')).toBeNull()
  })
})

// ------------------------------------------------------------
// class 数组/对象条件合并（两端）
// ------------------------------------------------------------
describe('class 数组/对象合并', () => {
  it('SSR：数组 + 对象 + 条件', () => {
    const ok = true
    const html = renderToString(
      <div class={['a', ok && 'b', { c: true, d: false }, null, undefined]} />,
    )
    expect(html).toContain('class="a b c"')
  })

  it('SSR：className 同语义', () => {
    const html = renderToString(<div className={['x', { y: true }]} />)
    expect(html).toContain('class="x y"')
  })

  it('客户端：class 数组/对象合并', () => {
    const ok = true
    function App() {
      return <div class={['a', ok && 'b', { c: true, d: false }]} />
    }
    const host = mount(App)
    const el = host.querySelector('div')!
    expect(el.className).toBe('a b c')
  })

  it('客户端：全假值 → 空 class', () => {
    function App() {
      return <div class={[false, undefined, { x: false }]} />
    }
    const host = mount(App)
    expect((host.querySelector('div') as HTMLElement).className).toBe('')
  })
})

// ------------------------------------------------------------
// SSR / 客户端两端一致性（P0 结构目标）
// ------------------------------------------------------------
describe('SSR/客户端两端一致', () => {
  it('同一组件：布尔属性 + enumerated + style 键集合一致', () => {
    const style = { width: 1, writingMode: undefined } as any
    function App() {
      return (
        <input
          type="checkbox"
          checked
          disabled
          contentEditable={true}
          style={style}
        />
      )
    }
    const html = renderToString(<App />)
    // SSR：checked/disabled 裸属性、contenteditable="true"、width:1px、无 undefined
    expect(html).toContain('checked')
    expect(html).toContain('disabled')
    expect(html).toContain('contenteditable="true"')
    expect(html).toContain('width:1px')
    expect(html).not.toContain('undefined')

    const host = mount(App)
    const input = host.querySelector('input')!
    expect(input.getAttribute('checked')).toBe('')
    expect(input.getAttribute('disabled')).toBe('')
    expect(input.getAttribute('contenteditable')).toBe('true')
    expect(input.style.width).toBe('1px')
    expect(input.style.getPropertyValue('writingMode')).toBe('')
  })
})
