// ============================================================
// @actview/plugin-scoped — 公共类型
// ============================================================

import type { BabelTransformOptions } from '@actview/plugin-babel'

/** actviewScopedPlugin() 选项 */
export interface ScopedPluginOptions {
  /**
   * 自定义 hash 生成函数（默认 md5(文件绝对路径).slice(0,8)）。
   * CSS 与 JSX 侧共用同一 hash，保证选择器与 DOM 属性匹配。
   */
  getHash?: (absPath: string) => string
  /** 属性/选择器前缀，默认 'data-v'（生成 data-v-<hash>） */
  attrPrefix?: string
  /**
   * Babel 宿主壳排除规则透传（node_modules 硬排除，不可覆盖）。
   * 源码分发主题/库包发布在 node_modules 下需要 scoped 注入时，
   * 在 vite config 里 alias 到包源码（路径脱离 node_modules 段）即可
   * （见 @actview/plugin-babel）。
   */
  babel?: BabelTransformOptions
}
