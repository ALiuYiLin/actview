// ============================================================
// v2 style 数字 → px（React 语义，编译期转换）
//   React 的 style={{ fontSize: 12 }} 自动加 px（unitless 属性除外）；
//   vue 运行时 patchStyle 原样赋值（无单位数字被浏览器忽略）——
//   @actview/plugin-jsx 编译期把 style 对象字面量里的数字转成 '12px'，
//   与 vue 模板编译器 transformStyle 的静态行为对齐。
// ============================================================
import { describe, expect, it } from 'vitest'
import { transformSync } from '@babel/core'
import jsxPlugin from '@actview/plugin-jsx'
import { createApp } from 'actview'

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2: style 数字 → px', () => {
  it('数字属性 → px（含负数）', () => {
    const App = () => (
      <div style={{ fontSize: 12, marginTop: -4 }}>x</div>
    )
    const host = mount(App)
    const style = (host.querySelector('div') as HTMLElement).getAttribute(
      'style',
    )
    expect(style).toContain('font-size: 12px')
    expect(style).toContain('margin-top: -4px')
  })

  it('unitless 属性不转（opacity/zIndex/lineHeight）', () => {
    const App = () => (
      <div style={{ opacity: 0.5, zIndex: 2, lineHeight: 1.9 }}>x</div>
    )
    const host = mount(App)
    const style = (host.querySelector('div') as HTMLElement).getAttribute(
      'style',
    )
    expect(style).toContain('opacity: 0.5')
    expect(style).toContain('z-index: 2')
    expect(style).toContain('line-height: 1.9')
  })

  it('三元分支里的数字也转 px', () => {
    const big = true
    const App = () => <p style={{ fontSize: big ? 20 : 13 }}>x</p>
    const host = mount(App)
    const style = (host.querySelector('p') as HTMLElement).getAttribute(
      'style',
    )
    expect(style).toContain('font-size: 20px')
  })

  it('--custom 属性与 0 值不转（React setValueForStyle 规则）', () => {
    const App = () => (
      <div style={{ '--count': 12, zIndex: 0, margin: 0 }}>x</div>
    )
    const host = mount(App)
    const style = (host.querySelector('div') as HTMLElement).getAttribute(
      'style',
    )
    // --count 数字原样（不加 px）
    expect(style).toContain('--count: 12')
    expect(style).not.toContain('--count: 12px')
    // zIndex unitless：0 直接有效
    expect(style).toContain('z-index: 0')
  })

  it('rotate/translate 数字加 px（React 白名单仅 scale；产物断言）', () => {
    const { code } = transformSync(
      `const App = () => <div style={{ rotate: 45, translate: 10, scale: 2 }} />`,
      {
        filename: 'x.tsx',
        plugins: [[jsxPlugin, {}]],
        parserOpts: { plugins: ['jsx', 'typescript'] },
        babelrc: false,
        configFile: false,
      },
    )!
    expect(code).toContain('rotate: "45px"')
    expect(code).toContain('translate: "10px"')
    expect(code).toContain('scale: 2')
  })

  it('字符串值原样保留', () => {
    const App = () => (
      <div style={{ fontSize: '20px', color: 'red' }}>x</div>
    )
    const host = mount(App)
    const style = (host.querySelector('div') as HTMLElement).getAttribute(
      'style',
    )
    expect(style).toContain('font-size: 20px')
    expect(style).toContain('color: red')
  })

  it('组件 props 的 style 原样不转（组件不消费则透传数字）', () => {
    function Box(props: any) {
      return <div style={props.style}>x</div>
    }
    const App = () => <Box style={{ width: 100 }} />
    const host = mount(App)
    const style = (host.querySelector('div') as HTMLElement).getAttribute(
      'style',
    )
    // 数字 100 无 px（编译期未转换）→ 无 '100px'；无单位宽度无效甚至被丢弃
    expect(style ?? '').not.toContain('100px')
  })
})
