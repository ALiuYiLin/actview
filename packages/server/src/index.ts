// ============================================================
// @actview/server — 公开入口
// ============================================================

export { createSSRApp } from './createSSRApp'
export type { SSRApp } from './createSSRApp'
export { hydrate, resolveHydrationContainer } from './hydrate'
export {
  renderToString,
  escapeHtml,
  escapeAttr,
  type RenderToStringOptions,
} from './renderToString'
