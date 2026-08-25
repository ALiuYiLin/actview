// ============================================================
// createApp — 创建应用实例
// ============================================================

import { render } from './renderer'
import { hydrate } from './hydrate'

export interface App {
  mount(container: string): void
  /** 客户端水合：容器已有 SSR 输出的 DOM，复用并绑定事件（不重建） */
  hydrate(container: string): void
}

/** 根组件 VNode：type 为组件（{ __setup }），props 为空 */
function buildRootVNode(rootComponent: unknown) {
  return {
    $$typeof: Symbol.for('react.element'),
    type: rootComponent,
    key: null,
    ref: null,
    props: {}
  }
}

/** 创建应用实例 */
export function createApp(rootComponent?: unknown): App {
  return {
    mount(container: string) {
      const host = document.querySelector<HTMLElement>(container)
      if (!host) {
        throw new Error(`[actview] createApp.mount: 找不到容器 ${container}`)
      }
      host.innerHTML = ''
      render(buildRootVNode(rootComponent), host)
    },
    hydrate(container: string) {
      const host = document.querySelector<HTMLElement>(container)
      if (!host) {
        throw new Error(`[actview] createApp.hydrate: 找不到容器 ${container}`)
      }
      hydrate(buildRootVNode(rootComponent), host)
    }
  }
}
