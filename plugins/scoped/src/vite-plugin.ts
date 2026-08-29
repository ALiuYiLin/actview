// ============================================================
// Vite 插件 — actviewScopedPlugin()
// 返回两个子插件（均 enforce:'pre'）：
//   css：处理 ?scoped query 的 .css，PostCSS 变换选择器
//   jsx：.tsx/.jsx/.js 中检测带 ?scoped 的 CSS import，Babel 注入 data-v-hash
// ============================================================

import path from 'node:path'
import { createBabelItem, transformWithBabel } from '@actview/plugin-babel'
import { transformScopedCSS, getHash } from './css.ts'
import { scopedBabelPlugin } from './babel.ts'
import type { ScopedPluginOptions } from './types.d.ts'

/** 模块 id 剥掉 query（dev 下 rolldown-vite 带 ?t= 时间戳）与 windows 反斜杠 */
function cleanId(id: string): string {
  return id.split('?')[0].replace(/\\/g, '/')
}

/** import 源 → 绝对路径（相对 importer 所在目录解析） */
function resolveCssPath(importSource: string, importer: string): string {
  const dir = path.dirname(importer.split('?')[0])
  return path.resolve(dir, importSource).split('?')[0].replace(/\\/g, '/')
}

export function actviewScopedPlugin(options: ScopedPluginOptions = {}) {
  const attrPrefix = options.attrPrefix ?? 'data-v'
  const hashFn = options.getHash ?? getHash
  const hashCache = new Map<string, string>()

  function hashFor(absPath: string): string {
    let h = hashCache.get(absPath)
    if (h === undefined) {
      h = hashFn(absPath)
      hashCache.set(absPath, h)
    }
    return h
  }

  /* ---------- 插件 A：CSS 变换 ---------- */
  const cssPlugin = {
    name: 'actview-scoped:css',
    enforce: 'pre' as const,
    applyToEnvironment() {
      // 全环境生效（浏览器构建 / SSR 等）
      return true
    },
    async transform(code: string, id: string) {
      if (!id.includes('.css')) return null
      if (!id.includes('?scoped')) return null
      const absPath = cleanId(id)
      const hash = hashFor(absPath)
      const transformed = await transformScopedCSS(code, hash, attrPrefix)
      return { code: transformed, map: null }
    },
  }

  /* ---------- 插件 B：JSX / TSX 注入 ---------- */
  const jsxPlugin = {
    name: 'actview-scoped:jsx',
    enforce: 'pre' as const,
    applyToEnvironment() {
      return true
    },
    async transform(
      this: {
        resolve?: (
          source: string,
          importer: string,
        ) => Promise<{ id: string } | null>
      },
      code: string,
      id: string,
    ) {
      const clean = cleanId(id)
      if (!/\.(tsx|jsx|js)$/.test(clean)) return null
      // 快速跳过：源码不含 ?scoped 时不解析（性能友好）。
      // node_modules 下的文件由宿主壳硬排除（transformWithBabel 返回 null）；
      // 源码分发主题/库包（actpress 场景）需要注入时，在 vite config 里
      // alias 到包源码 + optimizeDeps.exclude，路径脱离 node_modules 段即可。
      if (!code.includes('?scoped')) return null

      // 预解析 CSS import → 绝对路径（走 Vite resolver，alias/裸包路径正确，
      // 保证与 CSS 侧 cleanId(resolved id) 的 hash 一致）；直接调用（无 PluginContext）
      // 时回退 path.resolve 相对解析。source 带 ?scoped query，resolveCssPath 会剥掉。
      const cssImportMap = new Map<string, string>()
      for (const m of code.matchAll(
        /(?:^|;|\n)\s*import[^;]*?['"]([^'"]+\.css(?:\?[^'"]*)?)['"]/g,
      )) {
        const src = m[1]
        if (!src.includes('?scoped')) continue
        let abs: string | null = null
        if (this?.resolve) {
          try {
            const resolved = await this.resolve(src, id)
            if (resolved?.id) abs = cleanId(resolved.id)
          } catch {
            /* fallback 兜底 */
          }
        }
        cssImportMap.set(src, abs ?? resolveCssPath(src, id))
      }

      const pluginItem = createBabelItem(
        scopedBabelPlugin({
          resolveCssPath: (importSource) =>
            cssImportMap.get(importSource) ?? resolveCssPath(importSource, id),
          attrPrefix,
        }),
      )
      const result = transformWithBabel(code, id, pluginItem, options.babel)
      if (!result) return null
      const out = result.code
      // 无实际转换（有 ?scoped import 但无 JSX 元素）时原样返回，避免多余 transform
      const hasChanged = out.includes(`${attrPrefix}-`)
      if (!hasChanged) return null
      return { code: out, map: result.map as any }
    },
  }

  return [cssPlugin, jsxPlugin]
}

export default actviewScopedPlugin
