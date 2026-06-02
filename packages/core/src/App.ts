// ============================================================
// App — 应用入口
// 负责将组件挂载到指定 DOM 容器
// ============================================================
import type { Component } from '@actview/jsx'
import { mountComponent } from './component'

export interface AppOptions {
  /** 挂载前清空容器（默认 true） */
  clearContainer?: boolean
}

export class App {
  private options: AppOptions

  constructor(options: AppOptions = {}) {
    this.options = {
      clearContainer: true,
      ...options,
    }
  }

  /**
   * 将组件挂载到指定 DOM 容器
   *
   * @param component  组件函数 (props) => VNode
   * @param selector   CSS 选择器，如 '#app'、'.root'
   */
  mount(component: Component, selector: string) {
    const container =
      typeof selector === 'string'
        ? document.querySelector(selector)
        : selector

    if (!container) {
      throw new Error(
        `[@actview/core] mount target not found: "${selector}"`,
      )
    }

    mountComponent(
      () => component({}),
      container,
      {
        update: (nodes, el) => {
          if (this.options.clearContainer) {
            (el as HTMLElement).innerHTML = ''
          }
          nodes.forEach(n => el.appendChild(n))
        },
      },
    )
  }
}

/**
 * 快速创建 App 实例
 */
export function createApp(options?: AppOptions): App {
  return new App(options)
}
