// ============================================================
// @actview/server — createSSRApp
// ============================================================

import { createApp, type App, type ComponentPublicInstance } from '@actview/core'
import { renderToHTML, renderToString, type SSRHTMLResult } from './renderToString'
import { renderToStream } from './stream'
import { hydrate } from './hydrate'

export interface SSRApp extends App {
  /** 每次调用会创建新的组件实例；一个请求只调用一次。 */
  renderToString(): Promise<string>
  /** 渲染 HTML + head + state。 */
  renderToHTML(): Promise<SSRHTMLResult>
  /** 流式渲染。 */
  renderToStream(): AsyncGenerator<string>
  /** 在 SSR HTML 上 hydrate；rootProps 需与服务端一致。 */
  hydrate(rootContainer: Element | string): ComponentPublicInstance | null
}

/**
 * 创建 SSR 应用：与 createApp 相同的插件 / provide / config 能力，
 * 额外提供 renderToString() / renderToHTML() / renderToStream() / hydrate()。
 */
export function createSSRApp(
  rootComponent: any,
  rootProps: Record<string, any> | null = null,
): SSRApp {
  const app = createApp(rootComponent) as SSRApp
  app.renderToString = () => renderToString(app, rootProps)
  app.renderToHTML = () => renderToHTML(app, rootProps)
  app.renderToStream = () => renderToStream(app, rootProps)
  app.hydrate = (container) => hydrate(app, container, rootProps)
  return app
}
