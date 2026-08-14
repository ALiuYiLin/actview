// ============================================================
// @actview/plugin-scoped — 导出入口
// 纯编译期 scoped CSS：Babel 注入 data-v-hash 属性 + PostCSS 变换
// ============================================================

export { actviewScopedPlugin } from './vite-plugin.ts'
export { actviewScopedPlugin as default } from './vite-plugin.ts'
export { scopedBabelPlugin } from './babel.ts'
export { transformScopedCSS, getHash, scopeAttr } from './css.ts'
export type { ScopedPluginOptions } from './types.d.ts'
