// ============================================================
// P1：React 分组属性决策验收（resolveAttr 双端共用）
//   xlink/xml 命名空间、URL 清洗（javascript:）、数值校验、
//   overloaded（capture/download）、plain 布尔移除、布尔组补充键
// 运行：pnpm exec vitest run test/platform-diff/attr-p1.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, renderToString } from 'actview'

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'p1-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// xlink / xml 命名空间
// ------------------------------------------------------------
describe('P1：xlink/xml 命名空间属性', () => {
  it('SSR：xlinkHref → xlink:href、xmlLang → xml:lang', () => {
    const html = renderToString(
      <svg>
        <use xlinkHref="#icon" />
        <text xmlLang="en">t</text>
      </svg>,
    )
    expect(html).toContain('xlink:href="#icon"')
    expect(html).toContain('xml:lang="en"')
    expect(html).not.toContain('xlinkHref')
  })

  it('客户端：setAttributeNS 生效', () => {
    function App() {
      return (
        <svg>
          <use xlinkHref="#icon" />
          <text xmlSpace="preserve">t</text>
        </svg>
      )
    }
    const host = mount(App)
    expect(host.querySelector('use')!.getAttribute('xlink:href')).toBe('#icon')
    expect(host.querySelector('text')!.getAttribute('xml:space')).toBe('preserve')
  })

  it('xlinkHref 的 javascript: 同样清洗', () => {
    const html = renderToString(<use xlinkHref="javascript:alert(1)" />)
    expect(html).toContain('ActView has blocked')
  })
})

// ------------------------------------------------------------
// URL 清洗（sanitizeURL）
// ------------------------------------------------------------
describe('P1：URL 清洗', () => {
  it('SSR：javascript: 变体（含控制符/空白/换行混淆）被替换', () => {
    const html = renderToString(<a href="  JAVASCRIPT:\n\talert(1)">x</a>)
    expect(html).toContain('ActView has blocked')
  })

  it('客户端：javascript: 被替换、合法 URL 保留', () => {
    function App() {
      return (
        <div>
          <a class="bad" href="javascript:alert(1)">x</a>
          <a class="ok" href="/path?q=1">y</a>
          <a class="mail" href="mailto:a@b.c">z</a>
        </div>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.bad')!.getAttribute('href')).toContain('ActView has blocked')
    expect(host.querySelector('.ok')!.getAttribute('href')).toBe('/path?q=1')
    expect(host.querySelector('.mail')!.getAttribute('href')).toBe('mailto:a@b.c')
  })

  it('空串语义：src="" 移除、a href="" 保留', () => {
    function App() {
      return (
        <div>
          <img class="img" src="" />
          <a class="a" href="">rel</a>
        </div>
      )
    }
    const host = mount(App)
    expect(host.querySelector('.img')!.hasAttribute('src')).toBe(false)
    expect(host.querySelector('.a')!.getAttribute('href')).toBe('')
  })
})

// ------------------------------------------------------------
// 数值校验（cols/rows/size/span 正数、rowSpan/start 数字）
// ------------------------------------------------------------
describe('P1：数值属性校验', () => {
  it('cols：>=1 输出、0/负数移除（双端）', () => {
    function App() {
      return (
        <div>
          <textarea cols={2} rows={0} />
          <td colSpan={3} rowSpan={-1} />
          <ol start={-2} />
        </div>
      )
    }
    const html = renderToString(
      <textarea cols={2} rows={0} />,
    )
    expect(html).toContain('cols="2"')
    expect(html).not.toContain('rows')
    const host = mount(App)
    expect(host.querySelector('textarea')!.getAttribute('cols')).toBe('2')
    expect(host.querySelector('textarea')!.hasAttribute('rows')).toBe(false)
    expect(host.querySelector('td')!.getAttribute('colspan')).toBe('3')
    // rowSpan/start 组仅要求 !isNaN（React 语义）：负数合法输出
    expect(host.querySelector('td')!.getAttribute('rowspan')).toBe('-1')
    expect(host.querySelector('ol')!.getAttribute('start')).toBe('-2')
  })
})

// ------------------------------------------------------------
// overloaded（capture/download）
// ------------------------------------------------------------
describe('P1：overloaded 布尔（capture/download）', () => {
  it('true→裸属性、false→移除、字符串→值（双端）', () => {
    function App() {
      return (
        <div>
          <a class="d1" download>f1</a>
          <a class="d2" download={false}>f2</a>
          <a class="d3" download="r.pdf">f3</a>
          <input type="file" capture />
        </div>
      )
    }
    const html = renderToString(<a download>f</a>)
    expect(html).toContain('download') // SSR 裸属性
    const host = mount(App)
    expect(host.querySelector('.d1')!.getAttribute('download')).toBe('')
    expect(host.querySelector('.d2')!.hasAttribute('download')).toBe(false)
    expect(host.querySelector('.d3')!.getAttribute('download')).toBe('r.pdf')
  })
})

// ------------------------------------------------------------
// plain 布尔移除（React 语义：dir/role 等已知属性不接受 boolean）
// ------------------------------------------------------------
describe('P1：plain 属性布尔值移除（React 语义）', () => {
  it('dir={true} → 移除（此前 generic true→""，对齐 React 后移除）', () => {
    function App() {
      return <div class="d" dir={true as any} role={false as any} />
    }
    const html = renderToString(<div dir={true as any} />)
    expect(html).not.toContain('dir')
    const host = mount(App)
    expect(host.querySelector('.d')!.hasAttribute('dir')).toBe(false)
    expect(host.querySelector('.d')!.hasAttribute('role')).toBe(false)
  })
})

// ------------------------------------------------------------
// 布尔组补充键（ActView 自持：React 由 wrapper/反射处理）
// ------------------------------------------------------------
describe('P1：布尔组补充键', () => {
  it('inert/selected：SSR 裸属性 + 客户端 attribute（双端一致）', () => {
    function App() {
      return (
        <div>
          <button inert>i</button>
          <option selected>s</option>
        </div>
      )
    }
    const html = renderToString(<button inert>i</button>)
    expect(html).toContain('inert')
    const host = mount(App)
    expect(host.querySelector('button')!.getAttribute('inert')).toBe('')
    expect(host.querySelector('option')!.getAttribute('selected')).toBe('')
  })
})

// ------------------------------------------------------------
// 双端一致（resolveAttr 同源）
// ------------------------------------------------------------
describe('P1：SSR/客户端双端一致', () => {
  it('同一组件：命名空间 + 布尔 + enumerated + URL 清洗两端一致', () => {
    function App() {
      return (
        <div>
          <use xlinkHref="#i" />
          <a href="javascript:x" contentEditable={true}>x</a>
          <input checked disabled />
        </div>
      )
    }
    const html = renderToString(<App />)
    expect(html).toContain('xlink:href="#i"')
    expect(html).toContain('ActView has blocked')
    expect(html).toContain('contenteditable="true"')
    expect(html).toContain('checked')
    expect(html).toContain('disabled')

    const host = mount(App)
    expect(host.querySelector('use')!.getAttribute('xlink:href')).toBe('#i')
    expect(host.querySelector('a')!.getAttribute('href')).toContain('ActView has blocked')
    expect(host.querySelector('a')!.getAttribute('contenteditable')).toBe('true')
    expect(host.querySelector('input')!.getAttribute('checked')).toBe('')
    expect(host.querySelector('input')!.getAttribute('disabled')).toBe('')
  })
})
