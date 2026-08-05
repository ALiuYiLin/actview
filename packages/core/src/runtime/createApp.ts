// ============================================================
// createApp — 创建应用实例
// ============================================================

import { render } from './renderer'

export interface App {
  mount(container: string): void
}

/** 创建应用实例 */
export function createApp(rootComponent?: unknown): App {
  return {
    mount(container: string) {
      const host = document.querySelector<HTMLElement>(container)
      if (!host) {
        throw new Error(`[actview] createApp.mount: 找不到容器 ${container}`)
      }

      // 根组件 VNode：type 为组件（{ __setup }），props 为空
      const rootVnode = {
        $$typeof: Symbol.for('react.element'),
        type: rootComponent,
        key: null,
        ref: null,
        props: {}
      }

      host.innerHTML = ''
      render(rootVnode, host)
    }
  }
}
