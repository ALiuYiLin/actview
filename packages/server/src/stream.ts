// ============================================================
// @actview/server — 流式 SSR
// ============================================================

import { ErrorBoundary, KeepAlive, Suspense } from '@actview/core'
import {
  Fragment,
  Text,
  createComponentInstance,
  createVNode,
  isComponent,
  isVNode,
  renderComponentRoot,
  setupComponent,
  type AppContext,
  type ComponentInternalInstance,
  type VNode,
} from '@actview/core/server-internal'
import { createSSRContext } from './context'
import { attrsToString, escapeHtml } from './renderToString'
import { disposeSSRApp } from './dispose'

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

async function* streamChild(
  child: unknown,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): AsyncGenerator<string> {
  if (child == null || typeof child === 'boolean') return
  if (isVNode(child)) {
    yield* streamVNode(child, parent, context, instances)
    return
  }
  if (typeof child === 'string' || typeof child === 'number') {
    yield escapeHtml(String(child))
  }
}

async function* streamChildren(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): AsyncGenerator<string> {
  const raw: unknown[] = []
  for (const child of childrenOf(vnode)) flattenChildren(child, raw)
  for (const child of raw) {
    yield* streamChild(child, parent, context, instances)
  }
}

async function* streamVNode(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  context: AppContext,
  instances: ComponentInternalInstance[],
): AsyncGenerator<string> {
  const type = vnode.type

  if (type === Text) {
    yield escapeHtml(String(vnode.props?.text ?? ''))
    return
  }

  if (type === Fragment) {
    yield* streamChildren(vnode, parent, context, instances)
    return
  }

  if (isComponent(type)) {
    const lazyLoad = (type as unknown as {
      __actview_lazy_load__?: () => Promise<any>
    }).__actview_lazy_load__
    if (typeof lazyLoad === 'function') {
      const component = await lazyLoad()
      yield* streamVNode(
        createVNode(component, vnode.props),
        parent,
        context,
        instances,
      )
      return
    }

    if (type === Suspense) {
      yield* streamChildren(vnode, parent, context, instances)
      return
    }

    if (type === KeepAlive) {
      yield* streamChildren(vnode, parent, context, instances)
      return
    }

    if (type === ErrorBoundary) {
      const collected: string[] = []
      try {
        for await (const chunk of streamChildren(
          vnode,
          parent,
          context,
          instances,
        )) {
          collected.push(chunk)
          yield chunk
        }
      } catch (err) {
        // 已经向前输出的错误内容无法撤回；服务端优先保证可诊断。
        const fallback = vnode.props?.fallback
        const child =
          typeof fallback === 'function'
            ? fallback(err)
            : fallback ?? null
        for await (const chunk of streamChild(
          child,
          parent,
          context,
          instances,
        )) {
          yield chunk
        }
      }
      return
    }

    const instance = createComponentInstance(vnode, parent, context)
    instances.push(instance)
    const pending = setupComponent(instance)
    if (pending) await pending
    const tree = renderComponentRoot(instance)
    instance.subTree = tree
    if (tree) yield* streamVNode(tree, instance, context, instances)
    return
  }

  if (typeof type === 'string') {
    const tag = type
    const attrs = attrsToString(vnode.props)
    const voidTag = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(
      tag,
    )
    if (voidTag) {
      yield `<${tag}${attrs}>`
      return
    }
    yield `<${tag}${attrs}>`
    const innerHTML = vnode.props?.innerHTML
    if (innerHTML != null) {
      yield String(innerHTML)
    } else {
      yield* streamChildren(vnode, parent, context, instances)
    }
    yield `</${tag}>`
    return
  }

  const builtin = (type as { __builtin?: string })?.__builtin
  if (builtin === 'transition' || builtin === 'teleport') {
    yield* streamChildren(vnode, parent, context, instances)
    return
  }

  throw new Error(`[actview/server] 不支持的 VNode type：${String(type)}`)
}

/**
 * 流式 SSR：按 VNode 边界逐块 yield HTML。
 *
 * - 先输出父元素 opening tag，再等待异步子组件；
 * - 调用方负责写入 HTTP response；
 * - async generator 结束时会停止组件 scope。
 */
export async function* renderToStream(
  app: {
    component: any
    _context: AppContext
    _unmountHooks?: Array<() => void>
  },
  rootProps: Record<string, any> | null = null,
): AsyncGenerator<string> {
  const instances: ComponentInternalInstance[] = []
  const ssrContext = createSSRContext()
  const appContext = app._context as AppContext & {
    __ssrContext?: typeof ssrContext
  }
  const previous = appContext.__ssrContext
  appContext.__ssrContext = ssrContext
  const vnode = createVNode(app.component, rootProps)
  try {
    yield* streamVNode(vnode, null, appContext, instances)
    appContext.root = instances[0] ?? null
  } finally {
    appContext.__ssrContext = previous
    for (const instance of instances) instance.scope.stop()
    disposeSSRApp(app)
  }
}
