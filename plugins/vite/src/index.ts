// ============================================================
// @actview/plugin-vite — 导出入口
//   actviewPlugin      ：v1 管线（defineComponent 转换，esbuild JSX）
//   actviewJsxPlugin   ：v2 管线（@actview/plugin-jsx：React 语义 JSX
//                        + 自动 defineComponent，直出 createVNode）
// ============================================================

import { actviewPlugin } from './vite-plugin.ts'
import { actviewJsxPlugin } from './v2-jsx-plugin.ts'

export { actviewPlugin, actviewJsxPlugin }
export { actviewPlugin as default } from './vite-plugin.ts'
