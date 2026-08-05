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
      // rolldown-vite dev 的模块 id 带 ?t= 时间戳 query（HMR），剥掉再判断扩展名，
      // 否则 `id.endsWith('.tsx')` 永不匹配、Babel 转换不执行 → 组件以裸函数
      // 进入 ActView 运行时（只认 { __setup } VNode）→ createElement('function ...')
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('.tsx')) return null

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
