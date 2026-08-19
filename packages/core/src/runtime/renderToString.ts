import type { VNode, VNodeChild } from '../vnode'
import { setCurrentInstance } from './lifecycle'
import { extractScopedIdProps, SCOPED_ID_PROP } from './scopedProps'

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

/** 递归序列化单个节点；parentInjects 沿树向下传递（子组件共享父注入表引用，对齐运行时） */
function serializeNode(
  node: any,
  parentInjects?: Record<PropertyKey, any>,
): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) {
    return node.map((n) => serializeNode(n, parentInjects)).join('')
  }
  if (!isVNode(node)) return ''

  const { type, props } = node

  // Fragment：拼接子节点
  if (type === Fragment) {
    return toChildrenArray(props?.children)
      .map((n) => serializeNode(n, parentInjects))
      .join('')
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
    // 组件边界 scoped 转换（与运行时 mountComponent 一致）：注入的 data-v-*
    // 合并为 scopedId prop，子组件手动应用后经 serializeAttrs 翻译为真实属性
    const ssrProps = { ...(props ?? {}) }
    extractScopedIdProps(ssrProps)
    // 静态生成上下文：setup 里调用 onMounted 等生命周期钩子时必须有
    // currentInstance（否则警告「只能在组件 setup 中调用」并丢弃）。
    // 用轻量 instance（带钩子空数组即可注册），钩子注册后**不 flush**
    // （SSR/静态生成语义：setup + render，不执行 DOM 钩子，与 Vue SSR 一致）。
    // injects 继承父注入表引用（对齐运行时：子组件共享父表，provide 时 COW），
    // 使 provide/useInjects/createContext 在 SSR 下穿透可用。
    const ssrInstance = {
      props: ssrProps,
      beforeMount: [] as (() => void)[],
      mounted: [] as (() => void)[],
      updated: [] as (() => void)[],
      beforeUnmount: [] as (() => void)[],
      unmounted: [] as (() => void)[],
      activated: [] as (() => void)[],
      deactivated: [] as (() => void)[],
      errorCaptured: [] as ((err: any) => boolean | void)[],
      serverPrefetch: [] as (() => Promise<any> | any)[],
      renderTracked: [] as ((e: any) => void)[],
      renderTriggered: [] as ((e: any) => void)[],
      scope: null,
      parent: null,
      injects: (parentInjects ?? {}) as Record<PropertyKey, any>,
    }
    setCurrentInstance(ssrInstance as any)
    let render: any
    try {
      // setup(props, ctx)：ctx.injects 指向 ssrInstance 的注入表（继承父表引用）
      const ctx = { injects: ssrInstance.injects }
      render =
        typeof setup === 'function'
          ? setup(ssrProps, ctx)
          : type(ssrProps)
    } finally {
      setCurrentInstance(null)
    }
    // onServerPrefetch：SSR 阶段同步执行预取钩子（异步 Promise 无法等待，尽力而为）
    for (const hook of ssrInstance.serverPrefetch) hook()
    if (typeof render === 'function') {
      return serializeNode(render(), ssrInstance.injects)
    }
    // setup 直接返回 vnode（兼容简写）
    return serializeNode(render, ssrInstance.injects)
  }

  // 原生标签
  if (typeof type !== 'string') return ''
  const tag = type as string
  const attrs = serializeAttrs(props)
  const children = toChildrenArray(props?.children)
    .map((n) => serializeNode(n, parentInjects))
    .join('')
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
    // aria-* / data-*：布尔值字符串化（对齐运行时 setProp：true→"true"、
    // false→"false" 不移除；null/undefined 不输出）
    if (/^(aria|data)-/.test(key)) {
      if (value == null) continue
      out += ` ${key}="${escapeHtml(
        value === true ? 'true' : value === false ? 'false' : String(value),
      )}"`
      continue
    }
    if (value == null || value === false) continue
    // scopedId 约定（@actview/plugin-scoped）：值为 scoped 属性名（可空格分隔
    // 多个），翻译为真实属性输出 —— 与运行时 setProp/patchProps 语义一致
    if (key === SCOPED_ID_PROP) {
      if (typeof value === 'string') {
        for (const attr of value.split(/\s+/).filter(Boolean)) {
          out += ` ${attr}=""`
        }
      }
      continue
    }
    if (key === 'style') {
      const s = stringifyStyle(value)
      if (s) out += ` style="${escapeHtml(s)}"`
      continue
    }
    const name =
      key === 'className'
        ? 'class'
        : key === 'defaultValue'
          ? 'value'
          : key === 'defaultChecked'
            ? 'checked'
            : key
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
export function renderToString(vnode: VNode | VNodeChild): string {
  return serializeNode(vnode)
}
