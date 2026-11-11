// ============================================================
// @actview/compiler — L1：组件函数 → defineComponent(setup)
//
// 本包只做「包装层」：把声明位置上的 PascalCase 组件函数交付为
//   const Name = defineComponent(setup, "Name")
// 输出**仍保留 JSX**（以及 TS 注解），不负责 JSX 降级。
//
// JSX 降级（形如 <div/> → jsx("div", {...})）由宿主工具链的 automatic
// runtime 负责，运行时实现见 @actview/jsx（jsx / jsxs / Fragment）：
//   - Vite / esbuild：tsconfig 的 "jsx": "react-jsx" +
//     "jsxImportSource": "@actview/jsx" 已生效；
//   - tsc：同上（jsx: react-jsx）；
//   - 纯 Babel 环境：使用 @babel/plugin-transform-react-jsx
//     （runtime: 'automatic', importSource: '@actview/jsx'）。
//
// 契约详见 docs/compiler-layers.md。
// ============================================================

import { transformSync } from '@babel/core'
import wrapComponentsPlugin, { type WrapComponentsOptions } from './wrap.ts'

export { wrapComponentsPlugin }
export type { WrapComponentsOptions }

/** L1 编译选项 */
export interface CompileOptions {
  /** 源码路径（决定 TS/JSX parser 插件；缺省 `unknown.tsx`） */
  filename?: string
  /** 是否生成 source map（默认 true） */
  sourceMaps?: boolean
  /** 保留行号（默认 false；Vite 宿主可开启以改善开发期堆栈） */
  retainLines?: boolean
  /** defineComponent 的 import source（默认 `@actview/runtime-core`） */
  defineComponentSource?: string
}

export interface CompileResult {
  code: string
  map: unknown
}

/**
 * 按扩展名选择 parser 插件：
 *   - `.tsx` → JSX + TypeScript
 *   - `.ts`  → 仅 TypeScript（.ts 里的 `<T>() =>` 与 JSX 语法冲突）
 *   - `.jsx` → 仅 JSX
 *   - 其余（.js 等）→ JSX（JS 没有 TS 泛型歧义）
 */
function parserPluginsFor(filename: string): any[] {
  if (/\.tsx$/i.test(filename)) return ['jsx', 'typescript']
  if (/\.[cm]?ts$/i.test(filename)) return ['typescript']
  return ['jsx']
}

/**
 * L1：把模块中声明位置上的组件函数包装为 defineComponent(setup)。
 *
 * 输出仍含 JSX；调用方随后必须经过 automatic runtime 的 JSX 降级
 * （Vite/esbuild 默认完成）。返回 null 表示 Babel 没有产出。
 */
export function compileComponents(
  code: string,
  options: CompileOptions = {},
): CompileResult | null {
  const filename = options.filename ?? 'unknown.tsx'
  const result = transformSync(code, {
    filename,
    plugins: [
      [wrapComponentsPlugin, { importSource: options.defineComponentSource }],
    ] as unknown as [],
    parserOpts: { plugins: parserPluginsFor(filename) },
    babelrc: false,
    configFile: false,
    sourceMaps: options.sourceMaps ?? true,
    retainLines: options.retainLines ?? false,
  })
  if (!result) return null
  return { code: result.code ?? code, map: result.map }
}
