// ============================================================
// test/v2 专用 vite 插件：JSX → createVNode（@actview/plugin-jsx）
// 只作用于 test/v2/ 下的 .tsx/.ts；其余路径由 v1 管线（actviewPlugin）处理。
// ============================================================
import { createBabelItem, transformWithBabel } from '@actview/plugin-babel'
import pluginJsx from '@actview/plugin-jsx'

// plugin-jsx 是 declare() 产物（插件对象），createConfigItemSync 直接收对象
const item = createBabelItem(pluginJsx as any)

export function v2JsxPlugin() {
  return {
    name: 'actview-v2-jsx',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const cleanId = id.split('?')[0]
      if (!cleanId.includes('/test/v2/')) return null
      if (!cleanId.endsWith('.tsx') && !cleanId.endsWith('.ts')) return null
      const result = transformWithBabel(code, id, item)
      if (!result) return null
      return { code: result.code, map: result.map as any }
    },
  }
}
