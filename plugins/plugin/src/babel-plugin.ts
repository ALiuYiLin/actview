// ============================================================
// Babel 插件
//   function X() { return <JSX /> }
//   → const X = defineComponent(function() { return () => <JSX /> })
// 并在文件顶部自动注入 defineComponent 的 import
// ============================================================

import { types as t } from '@babel/core'

export default function defineComponentPlugin() {
  let hasTransformed = false

  return {
    visitor: {
      Program: {
        enter() {
          hasTransformed = false
        },
        exit(path: any) {
          if (!hasTransformed) return
          // 检查是否已有 defineComponent 导入
          const alreadyImported = path.node.body.some(
            (n: any) =>
              t.isImportDeclaration(n) &&
              n.source.value === '@local/core' &&
              n.specifiers.some((s: any) => s.imported?.name === 'defineComponent')
          )
          if (alreadyImported) return

          // 添加 import { defineComponent } from '@local/core'
          path.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier('defineComponent'), t.identifier('defineComponent'))],
              t.stringLiteral('@local/core'),
            ),
          )
        },
      },
      FunctionDeclaration(path: any) {
        const node = path.node
        // ---------- 1. 判断是不是组件 ----------
        if (!node.id) return
        const name = node.id.name
        // 首字母大写才是组件
        if (!/^[A-Z]/.test(name)) return

        // ---------- 2. 找 return ----------
        const body = node.body.body
        const last = body[body.length - 1]
        if (!t.isReturnStatement(last)) return
        if (!t.isJSXElement(last.argument) && !t.isJSXFragment(last.argument)) return

        hasTransformed = true

        // ---------- 3. return JSX → return () => JSX ----------
        last.argument = t.arrowFunctionExpression([], last.argument)

        // ---------- 4. defineComponent(function(){}) ----------
        const func = t.functionExpression(null, node.params, node.body, false, false)
        const call = t.callExpression(t.identifier('defineComponent'), [func])

        // ---------- 5. const X = defineComponent(...) ----------
        const declaration = t.variableDeclaration('const', [
          t.variableDeclarator(node.id, call),
        ])

        path.replaceWith(declaration)
      },
    },
  }
}
