import { defineConfig } from 'vite'
import path from 'path'
import * as babel from '@babel/core'

// 自定义 Vite 插件：将 function Component() 转为 defineComponent
function actviewPlugin() {
  return {
    name: 'actview-transform',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      if (!id.endsWith('.tsx')) return null

      const result = babel.transformSync(code, {
        filename: id,
        // @ts-ignore
        plugins: [[defineComponentPlugin]],
        parserOpts: {
          plugins: ['jsx', 'typescript'],
        },
        retainLines: true,
        sourceMaps: true,
      })

      if (!result) return null
      return {
        code: result.code || code,
        map: result.map as any,
      }
    },
  }
}

// Babel 插件：function X() { return <JSX /> } → const X = defineComponent(function() { return () => <JSX /> })
function defineComponentPlugin(api: any) {
  const t = api.types
  let hasTransformed = false

  return {
    visitor: {
      Program: {
        enter() { hasTransformed = false },
        exit(path: any) {
          if (!hasTransformed) return
          const alreadyImported = path.node.body.some(
            (n: any) =>
              t.isImportDeclaration(n) &&
              n.source.value === '@local/jsx-factory' &&
              n.specifiers.some((s: any) => s.imported?.name === 'defineComponent')
          )
          if (alreadyImported) return

          path.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier('defineComponent'), t.identifier('defineComponent'))],
              t.stringLiteral('@local/jsx-factory'),
            ),
          )
        },
      },
      FunctionDeclaration(path: any) {
        const node = path.node
        if (!node.id) return
        const name = node.id.name
        if (!/^[A-Z]/.test(name)) return

        const body = node.body.body
        const last = body[body.length - 1]
        if (!t.isReturnStatement(last)) return
        if (!t.isJSXElement(last.argument) && !t.isJSXFragment(last.argument)) return

        hasTransformed = true

        last.argument = t.arrowFunctionExpression([], last.argument)

        const func = t.functionExpression(null, node.params, node.body, false, false)
        const call = t.callExpression(t.identifier('defineComponent'), [func])
        const declaration = t.variableDeclaration('const', [t.variableDeclarator(node.id, call)])

        path.replaceWith(declaration)
      },
    },
  }
}

export default defineConfig({
  plugins: [actviewPlugin()],
  resolve: {
    alias: {
      '@local/jsx-factory': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
