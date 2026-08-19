// ============================================================
// 验收测试：renderToString（SSR 构建期 / 静态序列化）
//   覆盖：acceptance markdownToActView 产物 → renderToString、
//         静态序列化（标签 / 属性 / Fragment / 组件）+
//         SSR 生命周期上下文（onMounted 不警告 / 不执行）
// 拆分自 test/acceptance-renderToString.test.tsx 与 test/verify.test.tsx
// 运行：pnpm exec vitest run test/ssr/render-to-string.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, renderToString, onMounted } from 'actview'
import PageComponent, { __pageData } from '../fixtures/actview-page.js'

describe('acceptance: markdownToActView 产物 → renderToString 静态生成', () => {
  it('__pageData 契约不变', () => {
    expect(__pageData.title).toBe('Hello ActView')
  })

  it('renderToString 输出与浏览器挂载的 DOM 一致', () => {
    // 浏览器侧：createApp().mount() 完整挂载（happy-dom；mount 接受选择器）
    const host = document.createElement('div')
    host.id = 'acceptance-host'
    document.body.appendChild(host)
    createApp(PageComponent).mount('#acceptance-host')
    const domHtml = host.innerHTML

    // 构建期：renderToString 静态序列化（无 DOM）
    const tree = PageComponent.__setup({})()
    const staticHtml = renderToString(tree)

    expect(staticHtml).toBe(domHtml)
  })

  it('关键内容断言（实体/过滤/嵌套）', () => {
    const tree = PageComponent.__setup({})()
    const html = renderToString(tree)

    // 实体已解码并重新转义：&amp; → "&" → "&amp;"
    expect(html).toContain('and &amp; entity.')
    // markdown 里的 <tag> 文本正确转义，不会变成标签
    expect(html).toContain('&lt;tag&gt;')
    // on* 静态属性已被 markdownToActView 过滤，不出现在产物里
    expect(html).not.toContain('onclick')
    // 锚点符号 &#8203; 解码为零宽空格，静态输出原样保留
    expect(html).toContain('>​</a>')
    // void 元素不闭合
    expect(html).toContain('<img src="/x.png" alt="img" data-x="1">')
  })
})

// ------------------------------------------------------------
// 场景 22：renderToString 构建期静态序列化
// ------------------------------------------------------------
describe('场景 22：renderToString 构建期静态序列化', () => {
  it('原生标签 + 属性（class/style/布尔/事件跳过）+ 文本转义', () => {
    const html = renderToString(
      <div class="card" style={{ color: 'red', fontSize: '12px' }} onclick={() => {}} data-id="1">
        hello <b>&</b>
      </div>,
    )
    expect(html).toBe(
      '<div class="card" style="color:red;fontSize:12px" data-id="1">hello <b>&amp;</b></div>',
    )
  })

  it('空值/布尔/void 元素语义对齐 setProp', () => {
    const html = renderToString(
      <div>
        <input type="text" value="a" disabled={true} readonly={false} placeholder={null} />
        <br />
        <img src="/x.png" alt="" />
        <span hidden={true}>x</span>
      </div>,
    )
    expect(html).toBe(
      '<div><input type="text" value="a" disabled><br><img src="/x.png" alt=""><span hidden>x</span></div>',
    )
  })

  it('Fragment 拼接 + className 归一化为 class', () => {
    const html = renderToString(
      <>
        <span className="a">1</span>
        {null}
        {false}
        {42}
        <i>2</i>
      </>,
    )
    expect(html).toBe('<span class="a">1</span>42<i>2</i>')
  })

  it('静态组件：__setup + render 递归（无副作用场景）', () => {
    function Greet(props: { name: string }) {
      return <p class="greet">Hi, {props.name}</p>
    }
    const html = renderToString(<Greet name="actview" />)
    expect(html).toBe('<p class="greet">Hi, actview</p>')
  })

  it('children 数组 + 嵌套结构', () => {
    const html = renderToString(
      <ul>
        {[1, 2].map((n) => (
          <li key={n}>item{n}</li>
        ))}
      </ul>,
    )
    expect(html).toBe('<ul><li>item1</li><li>item2</li></ul>')
  })
})

// ------------------------------------------------------------
// 场景 28：renderToString 生命周期上下文
// ------------------------------------------------------------
describe('场景 28：renderToString 生命周期上下文', () => {
  it('setup 里调用 onMounted 不警告、产物正确（钩子不执行）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let mountedRan = false
    function Greet(props: any) {
      onMounted(() => {
        mountedRan = true
      })
      return <p class="greet">Hi, {props.name}</p>
    }
    const html = renderToString(<Greet name="actview" />)
    expect(html).toBe('<p class="greet">Hi, actview</p>')
    // 不再输出「生命周期钩子只能在组件 setup 中调用」
    expect(warn).not.toHaveBeenCalled()
    // SSR 语义：mounted 钩子不执行
    expect(mountedRan).toBe(false)
    warn.mockRestore()
  })
})