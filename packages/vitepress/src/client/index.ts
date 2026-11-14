// ============================================================
// @actview/vitepress — client entry (Phase 1 vertical slice)
// ============================================================

export { htmlToVNode } from './markdown/htmlToVNode'
export type {
  HtmlToVNodeOptions,
  MarkdownComponentMap,
} from './markdown/htmlToVNode'
export { Layout, Layout as DocsLayout } from './theme-default/Layout'
