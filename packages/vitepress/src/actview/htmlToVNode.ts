// ============================================================
// HTML → ActView VNode（Phase 1 运行时桥）
// ============================================================

import {
  Fragment,
  createElement,
  type ElementChild,
  type ElementType,
} from '@actview/core'
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5'

type HtmlNode = DefaultTreeAdapterMap['node']
type HtmlElement = DefaultTreeAdapterMap['element']
type HtmlText = DefaultTreeAdapterMap['textNode']

/** Markdown 自定义标签 → ActView 组件。key 使用小写标签名。 */
export type MarkdownComponentMap = Record<string, ElementType>

export interface HtmlToVNodeOptions {
  components?: MarkdownComponentMap
}

const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
])

const SKIP_TAGS = new Set(['script', 'style', 'template'])

function isElement(node: HtmlNode): node is HtmlElement {
  return (node as { nodeName?: unknown }).nodeName != null &&
    (node as { tagName?: unknown }).tagName != null
}

function isText(node: HtmlNode): node is HtmlText {
  return (node as { nodeName?: unknown }).nodeName === '#text'
}

function attrsToProps(element: HtmlElement): Record<string, any> {
  const props: Record<string, any> = {}
  for (const attr of element.attrs) {
    const name = attr.name
    if (BOOLEAN_ATTRS.has(name)) {
      props[name] = true
    } else {
      props[name] = attr.value
    }
  }
  return props
}

function toChild(
  node: HtmlNode,
  options: HtmlToVNodeOptions,
): ElementChild | null {
  if (isText(node)) return node.value
  if (!isElement(node)) return null

  const tag = node.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return null

  const children: ElementChild[] = []
  for (const child of node.childNodes) {
    const converted = toChild(child, options)
    if (converted != null) children.push(converted)
  }

  const props = attrsToProps(node)
  const component = options.components?.[tag]
  if (component) {
    props.children = children
    return createElement(component, props)
  }

  props.children = children
  return createElement(tag, props)
}

/**
 * 把 markdown-it 生成的 HTML 片段转成 ActView VNode。
 *
 * - 标准 HTML 标签使用原生 DOM 标签；
 * - `components` 按小写标签名映射自定义 ActView 组件；
 * - 文本节点原样保留（由渲染器统一归一化 / 转义）；
 * - script / style / template 在 Phase 1 跳过。
 */
export function htmlToVNode(
  html: string,
  options: HtmlToVNodeOptions = {},
): ElementChild {
  const fragment = parseFragment(html)
  const children: ElementChild[] = []
  for (const node of fragment.childNodes) {
    const child = toChild(node, options)
    if (child != null) children.push(child)
  }

  if (children.length === 1) return children[0]
  return createElement(Fragment, { children })
}
