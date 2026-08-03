import { types as t } from "@babel/core"

export default function () {
  return {
    visitor: {
      FunctionDeclaration(path: any) {
        const node = path.node

        // ---------- 1. 判断是不是组件 ----------
        if (!node.id) return

        const name = node.id.name

        // React组件：首字母大写
        if (!/^[A-Z]/.test(name)) return

        // ---------- 2. 找 return ----------
        const body = node.body.body

        const last = body[body.length - 1]

        if (!t.isReturnStatement(last)) return

        if (
          !t.isJSXElement(last.argument) &&
          !t.isJSXFragment(last.argument)
        ) {
          return
        }

        // ---------- 3. return JSX
        // =>
        // return ()=>JSX
        last.argument = t.arrowFunctionExpression(
          [],
          last.argument
        )

        // ---------- 4. defineComponent(function(){})
        const func = t.functionExpression(
          null,
          node.params,
          node.body,
          false,
          false
        )

        const call = t.callExpression(
          t.identifier("defineComponent"),
          [func]
        )

        // ---------- 5. const MyButton = defineComponent(...)
        const declaration =
          t.variableDeclaration("const", [
            t.variableDeclarator(
              node.id,
              call
            )
          ])

        path.replaceWith(declaration)
      }
    }
  }
}