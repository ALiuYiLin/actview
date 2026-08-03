// ============================================================
// Vite 插件
// .tsx 文件在 esbuild 之前过一遍 Babel，做 defineComponent 转换
// ============================================================

import * as babel from '@babel/core'
import defineComponentPlugin from './babel-plugin.ts'

// 模块级只创建一次 ConfigItem（Babel 8 同步版本）
const pluginItem = babel.createConfigItemSync(defineComponentPlugin, {
  type: 'plugin',
})

export function actviewPlugin() {
  return {
    name: 'actview-transform',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      if (!id.endsWith('.tsx')) return null

      const result = babel.transformSync(code, {
        filename: id,
        plugins: [pluginItem],
        parserOpts: {
          plugins: ['jsx', 'typescript'],
        },
        retainLines: true,
        sourceMaps: true,
      })

      if (!result) return null
      return {
        code: result.code || code,
        map: result.map as any,
      }
    },
  }
}
