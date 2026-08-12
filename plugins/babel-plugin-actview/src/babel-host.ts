// ============================================================
// babel-host.ts — 共享 Babel 宿主壳（Vite 插件复用）
// 把「ConfigItem 预编译 + transformSync 调用参数」从各 Vite 宿主插件中抽出：
//   - plugin-vite  ：静态插件（defineComponentPlugin）→ createBabelTransform 模块级调用一次
//   - plugin-scoped：动态插件（闭包捕获 cssImportMap）→ createBabelItem + transformWithBabel
// 统一参数：parserOpts(jsx+typescript) / retainLines / sourceMaps
//   babelrc:false / configFile:false —— ActView 编译完全由本插件决定，
//   不受宿主项目 babel 配置文件干扰（vite 场景 babel 配置本就不参与转换）。
// ============================================================

import * as babel from '@babel/core'
import type { PluginObject, PluginItem } from '@babel/core'

/** Babel 插件工厂形态（() => { visitor }），createConfigItemSync 的标准输入 */
export type BabelPlugin = () => PluginObject

/** transformSync 统一产物（result.map 类型为 BabelSourceMap | null | undefined） */
export interface BabelHostResult {
  code: string
  map: unknown
}

/** 把插件工厂预编译为 ConfigItem（Babel 8 同步版本，可跨多次 transformSync 复用） */
export function createBabelItem(plugin: BabelPlugin): PluginItem {
  return babel.createConfigItemSync(plugin as any, { type: 'plugin' })
}

/** 统一参数的 transformSync：失败返回 null，成功返回 { code, map } */
export function transformWithBabel(
  code: string,
  filename: string,
  pluginItem: PluginItem,
): BabelHostResult | null {
  const result = babel.transformSync(code, {
    filename,
    plugins: [pluginItem],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    retainLines: true,
    sourceMaps: true,
    babelrc: false,
    configFile: false,
  })
  if (!result) return null
  return { code: result.code || code, map: result.map }
}

/**
 * 静态插件的便捷工厂：模块级调用一次，ConfigItem 只创建一次。
 * 适用于插件对象不随文件变化的场景（如 defineComponentPlugin）。
 */
export function createBabelTransform(plugin: BabelPlugin) {
  const pluginItem = createBabelItem(plugin)
  return (code: string, filename: string): BabelHostResult | null =>
    transformWithBabel(code, filename, pluginItem)
}
