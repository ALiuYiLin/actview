// ============================================================
// App — 应用入口
// 负责将组件挂载到指定 DOM 容器
// ============================================================
import type { Component } from '@actview/jsx'
import { render } from './render'
import { getCurrentUpdateFn, setCurrentUpdateFn } from './reactivity/update'

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

    // 渲染函数
    const renderFn = () => {
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
    }

    // 响应式更新函数：render 前把自己设为当前更新函数，
    // 这样 ref 的 getter 访问时会把「自己」注册到事件总线，
    // 下次 ref 变化时继续触发自己 → 循环订阅。
    const update = () => {
      const prev = getCurrentUpdateFn()
      setCurrentUpdateFn(update)
      renderFn()
      setCurrentUpdateFn(prev)
    }

    // 初次渲染 + 注册依赖
    update()
  }
}

/**
 * 快速创建 App 实例
 */
export function createApp(options?: AppOptions): App {
  return new App(options)
}
