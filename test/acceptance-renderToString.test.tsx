// ============================================================
// 验收测试：vitepress markdownToActView 产物 → renderToString
//
// 验证 plan.md 阶段 A 的验收标准：
//   "renderToString 能把 markdownToActView 生成的 createElement 树
//    渲染成与浏览器 DOM 一致的 HTML 字符串"
//
// fixture（test/fixtures/actview-page.js）由 vitepress 的真实
// markdown 编译管线生成（含 <script setup>、实体、过滤 on* 等）。
// ============================================================

import { describe, expect, it } from 'vitest'
import { createApp, renderToString } from 'actview'
import PageComponent, { __pageData } from './fixtures/actview-page.js'

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
