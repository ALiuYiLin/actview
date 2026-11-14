// ============================================================
// Vite 插件：.md → ActView 页面模块
// ============================================================

import type { Plugin } from 'vite'
import { markdownToActview } from './markdownToActview.ts'

export interface ActviewMarkdownOptions {
  /** 只处理匹配的 id；默认所有 .md */
  include?: RegExp
}

export function actviewMarkdown(
  options: ActviewMarkdownOptions = {},
): Plugin {
  return {
    name: 'actview:vitepress-markdown',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('.md')) return null
      if (options.include && !options.include.test(cleanId)) return null
      if (id.includes('?raw') || id.includes('?url')) return null

      const result = markdownToActview(code, cleanId)
      return {
        code: result.code,
        map: null,
      }
    },
  }
}
