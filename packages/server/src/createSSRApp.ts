// ============================================================
// @actview/server — createSSRApp
// ============================================================

import { createApp, type App } from '@actview/core'
import { renderToString } from './renderToString'

export interface SSRApp extends App {
  /** 每次调用会创建新的组件实例；一个请求只调用一次。 */
  renderToString(): Promise<string>
}

/**
 * 创建 SSR 应用：与 createApp 相同的插件 / provide / config 能力，
 * 额外提供 renderToString()。
 */
export function createSSRApp(
  rootComponent: any,
  rootProps: Record<string, any> | null = null,
): SSRApp {
  const app = createApp(rootComponent) as SSRApp
  app.renderToString = () => renderToString(app, rootProps)
  return app
}
