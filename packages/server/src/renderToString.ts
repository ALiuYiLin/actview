// ============================================================
// @actview/server — SSR 字符串序列化（Phase 1）
// ============================================================

import {
  ErrorBoundary,
  KeepAlive,
  Suspense,
} from '@actview/core'
import {
  createSSRContext,
  type SSRContext,
} from './context'
import { disposeSSRApp } from './dispose'
import {
  createVNode,
  isVNode,
  isComponent,
  Fragment,
  Text,
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
  type AppContext,
  type ComponentInternalInstance,
  type VNode,
} from '@actview/core/server-internal'

/** SSR 字符串属性 */
const BOOLEAN_ATTRIBUTES = new Set([
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

const VOID_TAGS = new Set([
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
  'wbr',
])

const ESCAPE_RE = /[&<>"']/g
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(ESCAPE_RE, (char) => ESCAPE_MAP[char])
}

export function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function isEventKey(key: string): boolean {
  return /^on[A-Z]/.test(key)
}

/** scopedId / scopeId：值是空格分隔的属性名，SSR 输出布尔属性 */
function normalizeScopedIds(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(normalizeScopedIds)
  return []
}

function normalizeClass(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(normalizeClass).filter(Boolean).join(' ')
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key])
      .join(' ')
  }
  return String(value)
}

function styleToString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== false)
    .map(([key, v]) => {
      const name = key.startsWith('--')
        ? key
        : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      return `${name}:${String(v)}`
    })
    .join(';')
}

export function attrsToString(props: Record<string, any> | null): string {
  if (!props) return ''
  let out = ''
  for (const [key, value] of Object.entries(props)) {
    if (
      key === 'children' ||
      key === 'key' ||
      key === 'ref' ||
      key === 'innerHTML' ||
      key === 'textContent' ||
      isEventKey(key)
    ) {
      continue
    }
    if (value == null || value === false || typeof value === 'function') continue

    if (key === 'scopedId' || key === 'scopeId') {
      for (const id of normalizeScopedIds(value)) {
        if (/^[A-Za-z_:][\w:.-]*$/.test(id)) out += ` ${id}`
      }
      continue
    }

    if (key === 'class') {
      const cls = normalizeClass(value)
      if (cls) out += ` class="${escapeAttr(cls)}"`
      continue
    }
    if (key === 'style') {
      const style = styleToString(value)
      if (style) out += ` style="${escapeAttr(style)}"`
      continue
    }
    if (BOOLEAN_ATTRIBUTES.has(key)) {
      if (value) out += ` ${key}`
      continue
    }
    if (value === true) {
      out += ` ${key}`
      continue
    }
    out += ` ${key}="${escapeAttr(String(value))}"`
  }
  return out
}

function childrenOf(vnode: VNode): unknown[] {
  const children = vnode.props?.children
  if (children == null) return []
  return Array.isArray(children) ? children : [children]
}

function flattenChildren(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    for (const child of value) flattenChildren(child, out)
    return
  }
  out.push(value)
}

async function renderChildren(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): Promise<string> {
  const raw: unknown[] = []
  for (const child of childrenOf(vnode)) flattenChildren(child, raw)
  let out = ''
  for (const child of raw) {
    out += await renderChild(child, parent, context, instances)
  }
  return out
}

async function renderChild(
  child: unknown,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): Promise<string> {
  if (child == null || typeof child === 'boolean') return ''
  if (isVNode(child)) return renderVNode(child, parent, context, instances)
  if (typeof child === 'string' || typeof child === 'number') {
    return escapeHtml(String(child))
  }
  return ''
}

async function renderVNode(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): Promise<string> {
  const type = vnode.type

  if (type === Text) {
    return escapeHtml(String(vnode.props?.text ?? ''))
  }

  if (type === Fragment) {
    return renderChildren(vnode, parent, context, instances)
  }

  if (isComponent(type)) {
    // lazy：服务端直接加载最终组件，不渲染 loading / 局部状态
    const lazyLoad = (type as unknown as {
      __actview_lazy_load__?: () => Promise<any>
    }).__actview_lazy_load__
    if (typeof lazyLoad === 'function') {
      const component = await lazyLoad()
      return renderVNode(
        createVNode(component, vnode.props),
        parent,
        context,
        instances,
      )
    }

    // Suspense：服务端等待子树完成，输出与客户端初始结构一致的 wrapper + 边界标记
    if (type === Suspense) {
      const children = await renderChildren(vnode, parent, context, instances)
      return `<!--actview:suspense:start--><div>${children}</div><!--actview:suspense:end-->`
    }

    // KeepAlive：服务端直接渲染当前子树，不创建 DOM storage
    if (type === KeepAlive) {
      return renderChildren(vnode, parent, context, instances)
    }

    // ErrorBoundary：服务端捕获子树错误并输出 fallback
    if (type === ErrorBoundary) {
      try {
        return await renderChildren(vnode, parent, context, instances)
      } catch (err) {
        const fallback = vnode.props?.fallback
        if (typeof fallback === 'function') {
          return renderChild(fallback(err), parent, context, instances)
        }
        return fallback == null
          ? ''
          : renderChild(fallback, parent, context, instances)
      }
    }

    const instance = createComponentInstance(vnode, parent, context)
    instances.push(instance)
    const pending = setupComponent(instance)
    if (pending) await pending
    const tree = renderComponentRoot(instance)
    instance.subTree = tree
    return tree ? renderVNode(tree, instance, context, instances) : ''
  }

  if (typeof type === 'string') {
    const tag = type
    const attrs = attrsToString(vnode.props)
    if (VOID_TAGS.has(tag.toLowerCase())) return `<${tag}${attrs}>`
    const innerHTML = vnode.props?.innerHTML
    const children =
      innerHTML != null
        ? String(innerHTML)
        : await renderChildren(vnode, parent, context, instances)
    return `<${tag}${attrs}>${children}</${tag}>`
  }

  // 内置组件：Teleport 保留边界标记，客户端 hydration 据此把内联内容迁移到 target
  const builtin = (type as { __builtin?: string })?.__builtin
  if (builtin === 'transition') {
    return renderChildren(vnode, parent, context, instances)
  }
  if (builtin === 'teleport') {
    return `<!--actview:teleport:start-->${await renderChildren(
      vnode,
      parent,
      context,
      instances,
    )}<!--actview:teleport:end-->`
  }

  throw new Error(`[actview/server] 不支持的 VNode type：${String(type)}`)
}

export interface RenderToStringOptions {
  /** 暂保留；后续用于 streaming / context */
  context?: Record<string, unknown>
}

interface SSRAppLike {
  component: any
  _context: AppContext
  _unmountHooks?: Array<() => void>
}

async function renderApp(
  app: SSRAppLike,
  rootProps: Record<string, any> | null,
  ssrContext: SSRContext,
): Promise<string> {
  const instances: ComponentInternalInstance[] = []
  const appContext = app._context as AppContext & {
    __ssrContext?: SSRContext
  }
  const previous = appContext.__ssrContext
  appContext.__ssrContext = ssrContext
  const vnode = createVNode(app.component, rootProps)
  try {
    const html = await renderVNode(vnode, null, appContext, instances)
    appContext.root = instances[0] ?? null
    return html
  } finally {
    appContext.__ssrContext = previous
    // SSR 结束：停止组件 scope（watch/computed），避免请求间泄漏。
    for (const instance of instances) instance.scope.stop()
    disposeSSRApp(app)
  }
}

/**
 * 将根组件渲染为 HTML 字符串。
 *
 * 注意：每次调用都会创建新的组件实例；SSR 请求应使用新的 SSRApp。
 */
export async function renderToString(
  app: SSRAppLike,
  rootProps: Record<string, any> | null = null,
): Promise<string> {
  return renderApp(app, rootProps, createSSRContext())
}

export interface SSRHTMLResult {
  html: string
  head: string
  state: Record<string, unknown>
}

/**
 * 渲染 HTML，并返回 SSR context 收集到的 head / 初始 state。
 *
 * 组件可在 @Setup 中 `useSSRContext()` 写入 head / state。
 */
export async function renderToHTML(
  app: SSRAppLike,
  rootProps: Record<string, any> | null = null,
): Promise<SSRHTMLResult> {
  const context = createSSRContext()
  const html = await renderApp(app, rootProps, context)
  return {
    html,
    head: context.head.join('\n'),
    state: { ...context.state },
  }
}
