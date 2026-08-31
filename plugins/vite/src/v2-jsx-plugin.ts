// ============================================================
// actviewJsxPlugin — v2 JSX 编译管线（Vite 插件）
// .tsx/.ts/.jsx/.js 过 Babel（@actview/plugin-jsx）：
//   - JSX → createVNode 调用（React 语义映射：className/htmlFor/onChange）
//   - PascalCase 含 JSX 的函数自动包 defineComponent（React 函数组件语义）
// 与 v1 的 actviewPlugin（defineComponentPlugin）互斥：v2 项目/文件用本插件，
// v1 文件用 actviewPlugin（或用 include/exclude 分流）。
// node_modules 由 babel-host 硬排除。
// ============================================================

import { createBabelItem, transformWithBabel } from '@actview/plugin-babel'
import type { BabelTransformOptions } from '@actview/plugin-babel'
import pluginJsx from '@actview/plugin-jsx'

// plugin-jsx 是 declare() 产物（插件对象），createConfigItemSync 直接收对象
const item = createBabelItem(pluginJsx as any)

export interface ActviewJsxPluginOptions {
  /** Babel 宿主壳规则（include/exclude 路径过滤；node_modules 硬排除） */
  babel?: BabelTransformOptions
}

export function actviewJsxPlugin(options: ActviewJsxPluginOptions = {}) {
  return {
    name: 'actview-v2-jsx',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      const cleanId = id.split('?')[0]
      if (
        !cleanId.endsWith('.tsx') &&
        !cleanId.endsWith('.ts') &&
        !cleanId.endsWith('.jsx') &&
        !cleanId.endsWith('.js')
      ) {
        return null
      }
      const result = transformWithBabel(code, id, item, options.babel)
      if (!result) return null
      return { code: result.code, map: result.map as any }
    },
  }
}
