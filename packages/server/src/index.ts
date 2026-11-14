// ============================================================
// @actview/server — 公开入口
// ============================================================

export { createSSRApp } from './createSSRApp'
export type { SSRApp } from './createSSRApp'
export { hydrate, resolveHydrationContainer } from './hydrate'
export { renderToStream } from './stream'
export { createSSRContext, useSSRContext } from './context'
export type { SSRContext } from './context'
export { disposeSSRApp, type DisposableSSRApp } from './dispose'
export {
  renderDocument,
  type RenderDocumentOptions,
} from './renderDocument'
export {
  renderToString,
  renderToHTML,
  escapeHtml,
  escapeAttr,
  type RenderToStringOptions,
  type SSRHTMLResult,
} from './renderToString'
