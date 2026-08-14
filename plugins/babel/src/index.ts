// ============================================================
// @actview/plugin-babel — 导出入口
// Babel 插件：JSX 组件自动 defineComponent 转换（ActView 编译核心）
// ============================================================

export { default as defineComponentPlugin } from './babel-plugin.ts'
export { default } from './babel-plugin.ts'

// 共享 Babel 宿主壳（Vite 插件复用：plugin-vite / plugin-scoped）
export {
  createBabelTransform,
  createBabelItem,
  transformWithBabel,
} from './babel-host.ts'
export type { BabelHostResult } from './babel-host.ts'

export { default as solidPlugin } from './solid-plugin.ts'
