// ============================================================
// Vite 宿主：把 L1（组件包装）挂到 enforce: 'pre'
//   - 在 esbuild 之前运行：Babel 只做「组件函数 → defineComponent(setup)」；
//   - JSX 保留给宿主 automatic runtime 降级（tsconfig: react-jsx +
//     jsxImportSource @actview/jsx），esbuild 随后完成 JSX 降级 + TS 剥离；
//   - 因此本插件只依赖 L1，不需要（也不应该）在 compiler 里重复实现 L2。
//
// 默认排除 node_modules；本仓库的 vite.config 额外排除 packages/
// （库包源码走显式 defineComponent / 各自构建链，暂不经过本插件）。
// ============================================================

import type { Plugin } from 'vite'
import { compileComponents, type CompileOptions } from './index.ts'

export interface ActviewCompilerOptions extends CompileOptions {
  /** 白名单：命中任一规则才编译（正则，默认全部） */
  include?: RegExp[]
  /** 黑名单：命中任一规则即跳过（优先级高于 include） */
  exclude?: RegExp[]
}

const SCRIPT_RE = /\.(?:tsx?|jsx?)$/
const DEFAULT_EXCLUDE = [/[\\/]node_modules[\\/]/]

function matchAny(patterns: RegExp[], id: string): boolean {
  return patterns.some((re) => re.test(id))
}

/**
 * 粗筛：`.ts`/`.js` 里既没有 JSX、也没有疑似组件声明时跳过 Babel
 * （避免对纯工具模块做无意义的 parse/generate）。`.tsx`/`.jsx` 一律处理。
 */
function hasPotentialWork(code: string): boolean {
  return (
    /<[A-Za-z/>]/.test(code) ||
    /(?:^|[^\w$])(?:function\s+[A-Z]|(?:const|let|var)\s+[A-Z]\w*\s*[=(:])/.test(code)
  )
}

/** 创建 Vite 插件（`enforce: 'pre'`：在 esbuild/JSX 降级之前完成 L1 包装） */
export function actviewCompiler(options: ActviewCompilerOptions = {}): Plugin {
  const { include, exclude = DEFAULT_EXCLUDE, ...compileOptions } = options
  return {
    name: 'actview:compiler',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0]
      if (!SCRIPT_RE.test(cleanId)) return null
      if (matchAny(exclude, cleanId)) return null
      if (include && !matchAny(include, cleanId)) return null
      if (!/\.(?:tsx|jsx)$/.test(cleanId) && !hasPotentialWork(code)) return null

      const result = compileComponents(code, {
        ...compileOptions,
        filename: cleanId,
      })
      if (!result) return null
      return { code: result.code, map: result.map as never }
    },
  }
}

export default actviewCompiler
