// ============================================================
// compile — 用户代码 / 题目定义编译管线
//   输入：solution.tsx / challenge.ts（TSX，含 JSX + 组件）
//   输出：可执行 CJS（babel JSX + defineComponent 转换 + import 改写注入）
//
//   babel 转换后产物是 ESM（含 import/export），Node 不能直接执行，
//   再做一次 CJS 转换 + import 改写：
//     import { ref } from 'actview' → const { ref } = __actview
//   （避免依赖用户项目的 node_modules，全部由 CLI 注入运行时）
// ============================================================

import * as babel from '@babel/core'
import { defineComponentPlugin, createBabelTransform } from '@actview/plugin-babel'

// ------------------------------------------------------------
// 编译管线（两步，与 Vite 管线等价）：
//   1. babel preset-typescript：擦除 TS 类型注解（ref<number[]> → ref(...)）
//   2. createBabelTransform（框架编译核心）：JSX 编译 + 组件 defineComponent 包装
//   分开跑避免插件相互作用，且擦类型必须先行（否则泛型残留 → new Function 报错）
// ------------------------------------------------------------

function stripTypes(code: string, filename: string): string {
  const result = babel.transformSync(code, {
    filename,
    presets: [require('@babel/preset-typescript') as any],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    // 注意：retainLines 与 preset-typescript 组合在 Babel 8 有 bug
    // （泛型残留 + 输出截断），这里不开启
    sourceMaps: false,
    babelrc: false,
    configFile: false,
  })
  if (!result || !result.code) {
    throw new Error(`[challenges] TS 类型擦除失败: ${filename}`)
  }
  return result.code
}

// 框架 JSX/组件转换（模块级一次创建，跨调用复用 ConfigItem）
const transformJsx = createBabelTransform([defineComponentPlugin])

function babelTransform(code: string, filename: string): string {
  const js = stripTypes(code, filename)
  const out = transformJsx(js, filename)
  if (!out) {
    throw new Error(`[challenges] babel 编译失败: ${filename}`)
  }
  return out.code
}

// ------------------------------------------------------------
// CJS 转换 + import 改写插件
//   import { ref } from 'actview'              → const { ref } = __actview
//   import jsxRuntime from '@actview/jsx/jsx-runtime' → const _jsx = __jsxRuntime.jsx
//   export function X ... / export const X ...  → __exports.X = X
//   export default X                            → __exports.default = X
// ------------------------------------------------------------

/** 收集 import 源 → 注入变量名的映射 */
const IMPORT_SOURCES: Record<string, string> = {
  actview: '__actview',
  '@actview/core': '__actview',
  '@actview/jsx/jsx-runtime': '__jsxRuntime',
  '@actview/testing': '__testing',
  '@actview/challenges': '__challenges',
}

function importRewritePlugin(babel: any) {
  const t = babel.types
  return {
    name: 'challenges-import-rewrite',
    visitor: {
      ImportDeclaration(path: any) {
        const source = path.node.source.value
        const inject = IMPORT_SOURCES[source]
        if (!inject) {
          // 未知 import：原样保留（运行时注入的 require 会兜底）
          return
        }
        // 收集具名导入：import { a, b as c } from 'actview'
        const names: { local: string; imported: string }[] = []
        for (const spec of path.node.specifiers) {
          if (t.isImportSpecifier(spec)) {
            names.push({
              local: spec.local.name,
              imported: spec.imported.name,
            })
          } else if (t.isImportDefaultSpecifier(spec)) {
            // import X from 'actview'：整包注入
            path.replaceWith(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.identifier(spec.local.name),
                  t.identifier(inject),
                ),
              ]),
            )
            return
          }
        }
        // const { a, b: c } = __actview
        const props = names.map((n) =>
          n.local === n.imported
            ? t.objectProperty(t.identifier(n.local), t.identifier(n.local))
            : t.objectProperty(
                t.identifier(n.imported),
                t.identifier(n.local),
              ),
        )
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              t.objectPattern(props),
              t.identifier(inject),
            ),
          ]),
        )
      },
      // export function X / export const X = ... → __exports.X = X
      ExportNamedDeclaration(path: any) {
        const decl = path.node.declaration
        if (!decl) return
        if (t.isVariableDeclaration(decl)) {
          const assigns = decl.declarations.map((d: any) =>
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier('__exports'), d.id),
                d.init ?? t.identifier('undefined'),
              ),
            ),
          )
          path.replaceWithMultiple(assigns)
        } else if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
          const id = decl.id
          if (!id) return
          path.replaceWithMultiple([
            decl,
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier('__exports'), t.identifier(id.name)),
                t.identifier(id.name),
              ),
            ),
          ])
        }
      },
      // export default X → __exports.default = X
      ExportDefaultDeclaration(path: any) {
        const decl = path.node.declaration
        // 通用：__exports.default = <decl 求值>（函数声明转函数表达式）
        const expr = t.isFunctionDeclaration(decl)
          ? t.functionExpression(null, decl.params, decl.body, false, false)
          : t.cloneNode(decl, true)
        path.replaceWith(
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(t.identifier('__exports'), t.identifier('default')),
              expr,
            ),
          ),
        )
      },
    },
  }
}

/** 把 ESM 产物转成 CJS + import 改写（注入 __actview / __jsxRuntime / __testing / __exports） */
function toCjs(code: string, filename: string): string {
  const result = babel.transformSync(code, {
    filename,
    plugins: [importRewritePlugin],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    retainLines: true,
    sourceMaps: false,
    babelrc: false,
    configFile: false,
  })
  if (!result || !result.code) {
    throw new Error(`[challenges] CJS 转换失败: ${filename}`)
  }
  return result.code
}

// ------------------------------------------------------------
// 对外：编译 TSX → 可执行 CJS 源码字符串
// ------------------------------------------------------------

export function compileTsx(code: string, filename: string): string {
  const js = babelTransform(code, filename)
  return toCjs(js, filename)
}
