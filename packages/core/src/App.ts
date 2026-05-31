// ============================================================
// App — 应用入口
// 负责将组件挂载到指定 DOM 容器
// ============================================================
import type { Component } from '@actview/jsx'
import { render } from './render'

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
   * @returns          挂载的根 DOM 节点
   */
  mount(component: Component, selector: string): Node {
    const container =
      typeof selector === 'string'
        ? document.querySelector(selector)
        : selector

    if (!container) {
      throw new Error(
        `[@actview/core] mount target not found: "${selector}"`,
      )
    }

    // 清空容器
    if (this.options.clearContainer) {
      container.innerHTML = ''
    }

    // 执行组件 → VNode → 真实 DOM
    const vnode = component({})
    const dom = render(vnode)

    // 挂载
    const nodes = Array.isArray(dom) ? dom : [dom]
    for (const node of nodes) {
      container.appendChild(node)
    }

    return nodes[0]
  }
}

/**
 * 快速创建 App 实例
 */
export function createApp(options?: AppOptions): App {
  return new App(options)
}
