import { describe, expect, it } from 'vitest'
import { ActViewComponent, Component, createApp } from 'actview'
import type { Element } from '@actview/core'
import { htmlToVNode } from '../src/actview/htmlToVNode'
import { markdownToActview } from '../src/actview/markdownToActview'

describe('htmlToVNode', () => {
  it('转换标准 HTML 为 VNode', () => {
    const vnode = htmlToVNode(
      '<h1 id="intro">Hello &amp; <b>world</b></h1>',
    ) as Element

    expect(vnode.type).toBe('h1')
    expect(vnode.props?.id).toBe('intro')
    expect((vnode.props?.children as unknown[])[0]).toBe('Hello & ')
  })

  it('自定义标签映射到组件', () => {
    @Component({ name: 'Widget' })
    class Widget extends ActViewComponent {
      render() {
        return <span>widget</span>
      }
    }

    const vnode = htmlToVNode('<x-widget>hi</x-widget>', {
      components: { 'x-widget': Widget },
    }) as Element

    expect(vnode.type).toBe(Widget)
    expect(vnode.props?.children).toEqual(['hi'])
  })

  it('跳过 script / style', () => {
    const vnode = htmlToVNode(
      '<div><script>alert(1)</script><style>p{}</style><p>ok</p></div>',
    ) as Element
    expect(vnode.type).toBe('div')
    expect(vnode.props?.children).toHaveLength(1)
  })

  it('转换结果可以直接挂载', () => {
    const source = markdownToActview('# Mounted\n\nHello **world**', 'mounted.md')
    @Component({ name: 'MountedPage' })
    class Page extends ActViewComponent {
      render() {
        return htmlToVNode(source.html) as Element
      }
    }

    const root = document.createElement('div')
    document.body.appendChild(root)
    const app = createApp(Page)
    app.mount(root)

    expect(root.querySelector('h1')?.textContent).toBe('Mounted')
    expect(root.querySelector('strong')?.textContent).toBe('world')

    app.unmount()
    root.remove()
  })
})

describe('markdownToActview', () => {
  it('frontmatter / 标题 id / 页面模块', () => {
    const result = markdownToActview(
      `---\ntitle: Intro\n---\n\n# Hello\n\n\`\`\`ts\nconst x = 1\n\`\`\`\n`,
      'guide.md',
    )

    expect(result.pageData.title).toBe('Intro')
    expect(result.html).toContain('<h1 id="hello"')
    expect(result.html).toContain('<div class="vp-doc">')
    expect(result.code).toContain('__pageData')
    expect(result.code).toContain('htmlToVNode(PAGE_HTML)')
    expect(result.code).toContain('Component({ name: "guide.md" })(Page)')
  })

  it('拒绝 <script setup>', () => {
    expect(() =>
      markdownToActview('# Guide\n\n<script setup>const x = 1</script>', 'guide.md'),
    ).toThrow(/script setup/)
  })

  it('拒绝 Vue 指令', () => {
    expect(() =>
      markdownToActview('<div v-if="ok">x</div>', 'guide.md'),
    ).toThrow(/Vue 模板指令/)
  })

  it('拒绝正文插值，但代码块里的示例允许', () => {
    expect(() =>
      markdownToActview('# Hi\n\nHello {{ name }}', 'guide.md'),
    ).toThrow(/插值/)

    expect(() =>
      markdownToActview('# Hi\n\n```text\n{{ name }}\n```', 'guide.md'),
    ).not.toThrow()
  })
})
