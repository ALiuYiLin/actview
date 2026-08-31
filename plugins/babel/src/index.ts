// ============================================================
// @actview/plugin-babel — 导出入口
// 共享 Babel 宿主壳（Vite 插件复用：plugin-vite / plugin-scoped）
// ============================================================

export {
  createBabelTransform,
  createBabelItem,
  transformWithBabel,
  isExcludedTransform,
} from './babel-host.ts'
export type {
  BabelHostResult,
  BabelTransformOptions,
} from './babel-host.ts'
