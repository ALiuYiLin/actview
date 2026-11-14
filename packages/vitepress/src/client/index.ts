// ============================================================
// @actview/vitepress — client entry
// ============================================================

export { htmlToVNode } from './markdown/htmlToVNode'
export type {
  HtmlToVNodeOptions,
  MarkdownComponentMap,
} from './markdown/htmlToVNode'
export { Layout } from './theme-default/Layout'
export { setPageData, setThemeData } from './theme-default/composables/data'
