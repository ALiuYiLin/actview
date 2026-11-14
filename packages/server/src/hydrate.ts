// ============================================================
// @actview/server — 客户端 hydration
// ============================================================

import type { App, ComponentPublicInstance } from '@actview/core'
import {
  createVNode,
  hydrate as hydrateRenderer,
  type VNode,
} from '@actview/core/server-internal'

export function resolveHydrationContainer(
  rootContainer: Element | string,
): Element {
  if (typeof rootContainer === 'string') {
    const el = document.querySelector(rootContainer)
    if (!el) {
      throw new Error(`[actview] hydrate 失败：未找到容器 "${rootContainer}"`)
    }
    return el
  }
  return rootContainer
}

/**
 * 在已有 SSR HTML 上 hydrate。
 *
 * 注意：rootProps 必须与服务端 renderToString 时一致；组件树也需一致。
 */
export function hydrate(
  app: App,
  rootContainer: Element | string,
  rootProps: Record<string, any> | null = null,
): ComponentPublicInstance | null {
  const container = resolveHydrationContainer(rootContainer)
  const vnode = createVNode(app.component, rootProps) as VNode & {
    appContext?: App['_context']
  }
  vnode.appContext = app._context
  hydrateRenderer(vnode, container)
  app._container = container
  app._context.root =
    (vnode.component as unknown as App['_context']['root']) ?? null
  return (
    (vnode.component as unknown as { proxy?: ComponentPublicInstance } | null)
      ?.proxy ?? null
  )
}
