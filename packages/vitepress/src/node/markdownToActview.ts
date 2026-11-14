// ============================================================
// Markdown → ActView 页面模块（Phase 1）
// ============================================================

import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'

export interface PageData {
  title: string
  relativePath: string
  frontmatter: Record<string, any>
  headers: Array<{ level: number; title: string; slug: string; link: string }>
}

export interface MarkdownToActviewResult {
  code: string
  html: string
  pageData: PageData
}

export interface MarkdownToActviewOptions {
  /** markdown-it 的 html 选项，默认 true（VitePress 默认允许 HTML） */
  html?: boolean
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
})

md.use(anchor, {
  level: [1, 2, 3, 4],
})

function inferTitle(
  frontmatter: Record<string, any>,
  html: string,
): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title) {
    return frontmatter.title
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  if (!h1) return ''
  return h1[1].replace(/<[^>]+>/g, '').trim()
}

function extractHeaders(html: string) {
  const headers: PageData['headers'] = []
  const re = /<h([1-4])\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const title = match[3].replace(/<[^>]+>/g, '').trim()
    headers.push({
      level: Number(match[1]),
      title,
      slug: match[2],
      link: `#${match[2]}`,
    })
  }
  return headers
}

function findInterpolation(
  node: DefaultTreeAdapterMap['node'],
  inCode = false,
): string | null {
  const element = node as DefaultTreeAdapterMap['element']
  const isElement = element.tagName != null
  const nextInCode =
    inCode ||
    (isElement &&
      (element.tagName.toLowerCase() === 'pre' ||
        element.tagName.toLowerCase() === 'code'))

  if (!isElement && (node as DefaultTreeAdapterMap['textNode']).value != null) {
    const text = (node as DefaultTreeAdapterMap['textNode']).value
    if (!inCode && /\{\{[\s\S]*?\}\}/.test(text)) return text
  }

  for (const child of (node as { childNodes?: DefaultTreeAdapterMap['node'][] })
    .childNodes ?? []) {
    const found = findInterpolation(child, nextInCode)
    if (found) return found
  }
  return null
}

function assertSupported(html: string, file: string): void {
  if (/<script\b[^>]*\bsetup\b/i.test(html)) {
    throw new Error(
      `[actview/vitepress] ${file}：暂不支持 <script setup>（Phase 1 只支持纯 Markdown/HTML 页面）`,
    )
  }
  const vueAttr = /<[^>]+\s(?:v-[\w-]+|:[\w-]+|@[\w-]+)=/i.exec(html)
  if (vueAttr) {
    throw new Error(
      `[actview/vitepress] ${file}：暂不支持 Vue 模板指令/绑定（发现 ${vueAttr[0].trim()}）`,
    )
  }
  const interpolation = findInterpolation(parseFragment(html))
  if (interpolation) {
    throw new Error(
      `[actview/vitepress] ${file}：暂不支持 {{ }} 插值（发现 "${interpolation.trim()}"）`,
    )
  }
}

/**
 * 把一个 Markdown 文件转成 ActView 页面模块源码。
 *
 * Phase 1 只支持：
 * - 标准 Markdown + HTML；
 * - frontmatter；
 * - 代码块 / 链接 / 标题 id；
 * - 生成页面 class 的 render() = htmlToVNode(html)。
 *
 * 不支持 Vue 模板指令、{{ }}、<script setup>。
 */
export function markdownToActview(
  source: string,
  file: string,
  _options: MarkdownToActviewOptions = {},
): MarkdownToActviewResult {
  const parsed = matter(source)
  const html = md.render(parsed.content)
  assertSupported(html, file)

  const relativePath = file.replace(/\\/g, '/').split('/').pop() ?? file
  const pageData: PageData = {
    title: inferTitle(parsed.data, html),
    relativePath,
    frontmatter: parsed.data as Record<string, any>,
    headers: extractHeaders(html),
  }

  const wrappedHtml = `<div class="vp-doc">${html}</div>`
  const code = `
import { ActViewComponent, Component } from 'actview'
import { htmlToVNode } from '@actview/vitepress'

export const __pageData = ${JSON.stringify(pageData)}

const PAGE_HTML = ${JSON.stringify(wrappedHtml)}

class Page extends ActViewComponent {
  render() {
    return htmlToVNode(PAGE_HTML)
  }
}

Component({ name: ${JSON.stringify(relativePath)} })(Page)
export default Page
`

  return { code, html: wrappedHtml, pageData }
}
