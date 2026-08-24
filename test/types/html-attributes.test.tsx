// ============================================================
// HTML/SVG 属性补全（对齐 React HTMLAttributes 家族，编译期验证）
//   ts-expect-error 反向断言：tsc 编译期验证（同 generics.test.tsx）
// 运行：pnpm exec vitest run test/types/html-attributes.test.tsx（运行时）
//       pnpm exec tsc --noEmit（编译期断言）
// ============================================================

import { describe, it, expect } from 'vitest'

describe('HTML/SVG 属性补全（类型层）', () => {
  it('HTML 通用层新属性：inputMode / nonce / inert / is / microdata / RDFa', () => {
    const el = (
      <div
        inputMode="search"
        nonce="abc123"
        inert
        is="x-custom"
        autoCapitalize="words"
        autoCorrect="on"
        enterKeyHint="done"
        autoSave="off"
        itemScope
        itemID="id-1"
        about="a"
        property="p"
        typeof="x"
        contextMenu="ctx"
        radioGroup="g"
        unselectable="off"
        color="red"
      />
    )
    expect(el).toBeTruthy()
  })

  it('dialog / details：open + 专属事件', () => {
    const dlg = <dialog open onCancel={() => {}} onClose={() => {}} />
    expect(dlg).toBeTruthy()
    const det = <details open onToggle={() => {}} />
    expect(det).toBeTruthy()
  })

  it('input 新属性：crossOrigin / dirName / enterKeyHint', () => {
    const el = (
      <input crossOrigin="anonymous" dirName="dir" enterKeyHint="search" />
    )
    expect(el).toBeTruthy()
  })

  it('img / iframe / link 补全', () => {
    const img = (
      <img
        src="a.png"
        sizes="100vw"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        useMap="#map"
      />
    )
    expect(img).toBeTruthy()
    const iframe = (
      <iframe src="x" srcDoc="<p>hi</p>" seamless scrolling="no" frameBorder={0} />
    )
    expect(iframe).toBeTruthy()
    const link = <link rel="preload" as="style" fetchPriority="high" sizes="1x1" />
    expect(link).toBeTruthy()
  })

  it('无专属声明的元素：script / object / col / track / source / style', () => {
    const s = <script async defer src="app.js" noModule />
    expect(s).toBeTruthy()
    const o = <object data="x.pdf" type="application/pdf" width={100} />
    expect(o).toBeTruthy()
    const c = <col span={2} />
    expect(c).toBeTruthy()
    const t = <track default kind="captions" srcLang="en" />
    expect(t).toBeTruthy()
    const src = <source srcSet="a.webp" type="image/webp" media="(min-width: 800px)" sizes="50vw" />
    expect(src).toBeTruthy()
    const st = <style media="print" nonce="n1" />
    expect(st).toBeTruthy()
  })

  it('SVG 属性补全：文本锚点 / 描边偏移 / 滤镜 / 动画', () => {
    const svg = (
      <svg viewBox="0 0 10 10">
        <path
          d="M0 0"
          fillRule="evenodd"
          strokeDashoffset="2"
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          filter="url(#f)"
          begin="0s"
          repeatCount="indefinite"
          xlinkHref="#g"
          xmlLang="en"
        />
        <text letterSpacing="1" wordSpacing="2" writingMode="vertical-rl">
          t
        </text>
      </svg>
    )
    expect(svg).toBeTruthy()
  })

  it('错误类型仍被拦截', () => {
    // inert 是布尔，不接受字符串
    // @ts-expect-error inert 应为 boolean
    const bad1 = <div inert="x" />
    expect(bad1).toBeTruthy()
    // inputMode 有枚举约束
    // @ts-expect-error inputMode 枚举
    const bad2 = <div inputMode={123} />
    expect(bad2).toBeTruthy()
    // script 的 async 是布尔
    // @ts-expect-error async 应为 boolean
    const bad3 = <script async="true" />
    expect(bad3).toBeTruthy()
  })
})
