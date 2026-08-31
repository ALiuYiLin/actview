// ============================================================
// babel-host.ts — 共享 Babel 宿主壳（Vite 插件复用）
// 把「ConfigItem 预编译 + transformSync 调用参数」从各 Vite 宿主插件中抽出：
//   - plugin-vite  ：静态插件（defineComponentPlugin）→ createBabelTransform 模块级调用一次
//   - plugin-scoped：动态插件（闭包捕获 cssImportMap）→ createBabelItem + transformWithBabel
// 统一参数：parserOpts(jsx+typescript) / retainLines / sourceMaps
//   babelrc:false / configFile:false —— ActView 编译完全由本插件决定，
//   不受宿主项目 babel 配置文件干扰（vite 场景 babel 配置本就不参与转换）。
//
// 排除规则（2.1.0 新增）：node_modules 下的文件【硬排除】——依赖是第三方代码，
// 属依赖管线（esbuild 预构建），不是源码管线；源码编译器不碰 node_modules
// （babel-loader / @rollup/plugin-babel 同款默认）。库需要发布 ActView 组件时
// 用自己的构建链编译出 dist；真需现场编译源码分发库包的消费者，在
// vite/rollup config 里做路径转换（alias 到包源码 + optimizeDeps.exclude），
// 使文件解析路径不再含 node_modules 段，即可正常进入转换。
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

/** 宿主壳排除规则（createBabelTransform / transformWithBabel 第二/四参） */
export interface BabelTransformOptions {
  /** 白名单：文件命中任一规则才转换（默认不过滤；node_modules 硬排除优先） */
  include?: Array<string | RegExp>
  /** 黑名单：命中任一规则即跳过（优先级高于 include） */
  exclude?: Array<string | RegExp>
}

/** node_modules 段（/ 与 \ 双兼容，含路径起点）——硬排除，任何规则不可覆盖 */
const NODE_MODULES_RE = /(^|[\\/])node_modules[\\/]/

function matchesRule(rule: string | RegExp, filename: string): boolean {
  return typeof rule === 'string' ? filename.includes(rule) : rule.test(filename)
}

/** 是否应跳过转换：node_modules 硬排除 / 未命中 include / 命中 exclude */
export function isExcludedTransform(
  filename: string,
  options?: BabelTransformOptions,
): boolean {
  const norm = filename.replace(/\\/g, '/')
  // 硬门：node_modules 永不转换。需要编译 node_modules 下的源码库包？
  // 在 vite/rollup config 里 alias 到包源码（路径脱离 node_modules 段）。
  if (NODE_MODULES_RE.test(norm)) return true
  if (options?.include?.length && !options.include.some((r) => matchesRule(r, norm))) {
    return true
  }
  if (options?.exclude?.some((r) => matchesRule(r, norm))) return true
  return false
}

/** 把插件工厂预编译为 ConfigItem（Babel 8 同步版本，可跨多次 transformSync 复用）；
 *   pluginOptions 非空时按 [plugin, options] 元组创建（Babel 标准插件选项） */
export function createBabelItem(
  plugin: BabelPlugin,
  pluginOptions?: object,
): PluginItem {
  return babel.createConfigItemSync(
    pluginOptions == null ? (plugin as any) : [plugin as any, pluginOptions],
    { type: 'plugin' },
  )
}

/** 统一参数的 transformSync：排除命中或失败返回 null，成功返回 { code, map } */
export function transformWithBabel(
  code: string,
  filename: string,
  pluginItem: PluginItem,
  options?: BabelTransformOptions,
): BabelHostResult | null {
  if (isExcludedTransform(filename, options)) return null
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
export function createBabelTransform(
  plugin: BabelPlugin | BabelPlugin[],
  options?: BabelTransformOptions,
) {
  const items = (Array.isArray(plugin) ? plugin : [plugin]).map((p) => createBabelItem(p))
  return (code: string, filename: string): BabelHostResult | null => {
    if (isExcludedTransform(filename, options)) return null
    const result = babel.transformSync(code, {
      filename,
      plugins: items,
      parserOpts: { plugins: ['jsx', 'typescript'] },
      retainLines: true,
      sourceMaps: true,
      babelrc: false,
      configFile: false,
    })
    if (!result) return null
    return { code: result.code || code, map: result.map }
  }
}
