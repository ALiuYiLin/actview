// ============================================================
// @actview/plugin-scoped — 公共类型
// ============================================================

/** actviewScopedPlugin() 选项 */
export interface ScopedPluginOptions {
  /**
   * 自定义 hash 生成函数（默认 md5(文件绝对路径).slice(0,8)）。
   * CSS 与 JSX 侧共用同一 hash，保证选择器与 DOM 属性匹配。
   */
  getHash?: (absPath: string) => string
  /** 属性/选择器前缀，默认 'data-v'（生成 data-v-<hash>） */
  attrPrefix?: string
}
