// ============================================================
// @actview/devtools — app 插件
//
//   if (import.meta.env.DEV) {
//     app.use(devtoolsPlugin, { appName: 'My App' })
//   }
//
// 后端是全局单例；多个 app 共享同一个 hook / store。
// 所有 app 卸载后解除 hook。
// ============================================================

import type { AppPlugin } from '@actview/core'
import { setDevtoolsHook } from '@actview/core'
import { DevtoolsBackend } from './backend'

export interface DevtoolsPluginOptions {
  /** 面板 / 扩展中显示的 app 名 */
  appName?: string
  /** 事件 ring buffer 大小（默认 500） */
  maxEvents?: number
  /** false 时不安装，便于手动控制 */
  enabled?: boolean
}

let backend: DevtoolsBackend | null = null

/** 获取（或创建）全局 DevTools backend；不自动注册 hook。 */
export function getDevtoolsBackend(
  options: Pick<DevtoolsPluginOptions, 'maxEvents'> = {},
): DevtoolsBackend {
  if (!backend) backend = new DevtoolsBackend(options)
  return backend
}

/** 清空并解除 hook，主要供测试 / HMR 使用。 */
export function resetDevtoolsBackend(): void {
  setDevtoolsHook(null)
  backend?.clear()
  backend = null
}

export const devtoolsPlugin: AppPlugin<DevtoolsPluginOptions> = {
  name: 'devtools',
  install(app, options = {}) {
    if (options.enabled === false || app.config.devtools === false) return

    if (options.appName) app._context.name = options.appName
    const store = getDevtoolsBackend({ maxEvents: options.maxEvents })
    setDevtoolsHook(store.hook)

    app.onUnmount(() => {
      store.detachApp(app._context.appId)
      if (store.appCount === 0) setDevtoolsHook(null)
    })
  },
}
