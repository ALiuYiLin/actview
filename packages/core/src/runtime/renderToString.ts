import type { VNode } from '@actview/jsx'

// ============================================================
// renderToString — 构建期/SSR 前置：VNode 树 → HTML 字符串
//   纯函数序列化，无 DOM 依赖，可在 Node 端（构建脚本/SSR）使用
//
// 能力范围（静态生成语义）：
//   - 字符串标签    =》 <div class="..." style="...">children</div>
//   - Fragment      =》 子节点拼接
//   - 文本/数字     =》 HTML 转义
//   - 组件          =》 调用 __setup(props) 拿 render，再 render() 递归
//                      （构建期要求组件无副作用；响应式/事件在静态输出中不生效）
//   - 事件属性 on*  =》 跳过（静态 HTML 无事件）
//   - class/style/value/checked 等 =》 对齐运行时 setProp 语义输出属性
//   - void 元素（input/br/img/hr/meta/link 等）=》 不输出闭合标签
// ============================================================

/** void 元素：HTML 规范中无内容、不闭合 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

/** Fragment 标记（与 renderer/jsxFactory 一致：Symbol.for 全局共享） */
const Fragment = Symbol.for('react.fragment')

/** 布尔属性：值为 true 时输出空属性（如 disabled/checked/readonly） */
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'readonly',
  'required',
  'multiple',
  'selected',
  'hidden',
  'autofocus',
  'novalidate',
  'defer',
  'async'
])

/** HTML 文本/属性转义 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** style 对象 → "k:v;k2:v2;" 字符串（camelCase 键原样输出） */
function stringifyStyle(
  style: string | Record<string, string | number>
): string {
  if (typeof style === 'string') return style
  if (!style) return ''
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

/** 归一化 children：单值 → 数组 */
function toChildrenArray(children: any): any[] {
  if (children == null || typeof children === 'boolean') return []
  return Array.isArray(children) ? children : [children]
}

/** 是否为合法 VNode */
function isVNode(node: any): node is VNode {
  return !!node && typeof node === 'object' && typeof node.$$typeof === 'symbol'
}

/** 递归序列化单个节点 */
function serializeNode(node: any): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) return node.map(serializeNode).join('')
  if (!isVNode(node)) return ''

  const { type, props } = node

  // Fragment：拼接子节点
  if (type === Fragment) {
    return toChildrenArray(props?.children).map(serializeNode).join('')
  }

  // 组件：__setup(props) 拿 render =》 render() 递归（构建期静态，无响应式上下文）
  //   type 形态：Babel 转换 =》 defineComponent 产物（对象 { __setup }）；
  //   也兼容函数形态（__setup 属性或直接调用）
  const isComponent =
    typeof type === 'function' ||
    (typeof type === 'object' &&
      type != null &&
      typeof (type as any).__setup === 'function')
  if (isComponent) {
    const setup = (type as any).__setup
    const render =
      typeof setup === 'function' ? setup(props ?? {}) : type(props ?? {})
    if (typeof render === 'function') {
      return serializeNode(render())
    }
    // setup 直接返回 vnode（兼容简写）
    return serializeNode(render)
  }

  // 原生标签
  if (typeof type !== 'string') return ''
  const tag = type as string
  const attrs = serializeAttrs(props)
  const children = toChildrenArray(props?.children).map(serializeNode).join('')
  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`
  return `<${tag}${attrs}>${children}</${tag}>`
}

/** 属性 → 属性字符串（事件跳过、布尔/空值语义对齐 setProp） */
function serializeAttrs(props: Record<string, any> | null | undefined): string {
  if (!props) return ''
  let out = ''
  for (const key of Object.keys(props)) {
    if (key === 'children' || key === 'key' || key === 'ref') continue
    if (key.startsWith('on')) continue // 事件不输出
    const value = props[key]
    if (value == null || value === false) continue
    if (key === 'style') {
      const s = stringifyStyle(value)
      if (s) out += ` style="${escapeHtml(s)}"`
      continue
    }
    const name = key === 'className' ? 'class' : key
    if (value === true) {
      // 布尔属性：输出空属性（对齐 setAttribute(key, '')）
      out += ` ${name}${BOOLEAN_ATTRS.has(name) ? '' : '=""'}`
      continue
    }
    out += ` ${name}="${escapeHtml(String(value))}"`
  }
  return out
}

/** VNode 树 → HTML 字符串 */
export function renderToString(vnode: any): string {
  return serializeNode(vnode)
}
