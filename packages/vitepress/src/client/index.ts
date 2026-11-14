// ============================================================
// @actview/vitepress — client entry
// ============================================================

export { htmlToVNode } from './markdown/htmlToVNode'
export type {
  HtmlToVNodeOptions,
  MarkdownComponentMap,
} from './markdown/htmlToVNode'
export { Layout } from './theme-default/Layout'
export { createDocsApp } from './app/createDocsApp'
export type { DocsAppOptions, DocsPageModule } from './app/createDocsApp'
export { setPageData, setThemeData } from './theme-default/composables/data'
export { setHeaders, setSidebar, useLayout } from './theme-default/composables/layout'
