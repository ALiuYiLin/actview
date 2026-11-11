// ============================================================
// L1 包装插件（actview:wrap-components）
//
// 只做“组件定义点 → defineComponent(setup)”这一层，不读、不改 JSX 语义：
//
//   function App() { return <div /> }
//   → const App = defineComponent(function () { return () => <div /> }, "App")
//
//   并在文件顶部（仅当发生过转换且尚未导入时）注入：
//   import { defineComponent } from '@actview/runtime-core'
//
// 契约要点：
//   - 组件候选：PascalCase 函数声明；PascalCase 变量声明且 init 为函数
//     （init 里 as / ! / satisfies 断言先解包，包装后重新套在 defineComponent
//     调用外）；export default 的函数声明 / 函数表达式 / 箭头（匿名也包，
//     具名传其函数名）。
//   - 组件函数自身的每条直接 return（排除嵌套函数）：
//       裸 return            → return () => null
//       return 箭头/函数字面量 → 报错（已废弃的 setup 风格，带代码帧）
//       其它                  → return () => <原表达式>
//     箭头 expression body    → body 变 block：{ return () => <原 body> }
//     末尾不是 ReturnStatement → 追加 return () => null
//   - generator 报错；async 保留；typeParameters 保留；returnType 剥掉
//     （setup 现在返回 render 函数而不是 Element）。
//   - 幂等：init / 默认导出已是 CallExpression 时跳过。
//   - 非组件（小写函数、对象属性、类方法、赋值表达式、三元包裹的函数值）不动。
//
// L2（JSX 降级）由独立插件负责，本插件不注入 jsx import。
// ============================================================

import { types as t } from '@babel/core'

/** 包装插件选项 */
export interface WrapComponentsOptions {
  /** defineComponent 的 import source（默认 `@actview/runtime-core`） */
  importSource?: string
}

const DEFAULT_IMPORT_SOURCE = '@actview/runtime-core'

/** 组件名：PascalCase（首字母大写） */
const COMPONENT_NAME_RE = /^[A-Z]/

function isComponentName(name: string | null | undefined): name is string {
  return typeof name === 'string' && COMPONENT_NAME_RE.test(name)
}

/** init / 声明上可能包裹函数的 TS 断言节点 */
function isTsWrapper(node: any): boolean {
  return (
    t.isTSAsExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSSatisfiesExpression(node)
  )
}

/** 解包 TS 断言，返回内层表达式与断言链（外 → 内） */
function unwrapTsWrappers(node: any): { inner: any; wrappers: any[] } {
  const wrappers: any[] = []
  let inner = node
  while (isTsWrapper(inner)) {
    wrappers.push(inner)
    inner = inner.expression
  }
  return { inner, wrappers }
}

/**
 * 把断言链重新套在包装结果外（内层先套，保持原有嵌套顺序）：
 *   ((() => <div />) as F)!  →  (defineComponent(...) as F)!
 */
function reapplyTsWrappers(expression: any, wrappers: any[]): any {
  let wrapped = expression
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const clone: any = t.cloneNode(wrappers[i])
    clone.expression = wrapped
    wrapped = clone
  }
  return wrapped
}

/** 渲染函数字面量（已废弃的 setup 风格返回值） */
function isFunctionLiteral(node: any): boolean {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)
}

/** 优先用 Babel 的代码帧报错（携带源码定位），失败时退回普通 Error */
function buildCodeFrameError(path: any, message: string): Error {
  if (path && typeof path.buildCodeFrameError === 'function') {
    try {
      return path.buildCodeFrameError(message)
    } catch {
      // fall through：无 hub/loc 时 buildCodeFrameError 会抛，退回普通 Error
    }
  }
  return new Error(message)
}

function componentLabel(name?: string): string {
  return name ? `组件 ${name}` : '组件函数'
}

/** 已废弃 setup 风格（组件体内 return 渲染函数）的编译期报错 */
function buildSetupStyleError(path: any, name?: string): Error {
  const subject = name ? `组件 ${name} 体内` : '组件函数体内'
  return buildCodeFrameError(
    path,
    `[actview] 已废弃的 setup 风格：${subject} return 了渲染函数` +
      '（() => JSX / function () { ... }）。\n' +
      'ActView 只支持简写组件——直接 return JSX，插件会自动包装 render 函数：\n\n' +
      '    ✗ function App() { return () => <div /> }\n' +
      '    ✓ function App() { return <div /> }\n',
  )
}

/** generator 组件函数的编译期报错 */
function buildGeneratorError(path: any, name?: string): Error {
  return buildCodeFrameError(
    path,
    `[actview] 不支持 generator ${componentLabel(name)}（function*）。` +
      '组件必须是普通函数：function App() { return <div /> }',
  )
}

/**
 * 把组件函数“简写 setup”化为“setup 返回 render 函数”：
 *   - 函数体自身的每条直接 return 包成 `() => <表达式>`；
 *   - 裸 return → `() => null`；
 *   - return 函数字面量 → 报错；
 *   - 箭头 expression body → block；末尾非 return → 追加 `return () => null`。
 *
 * @param fnNode  要改写的函数节点（可能与 fnPath 的节点不同：函数声明转函数表达式时
 *                函数表达式与声明共享 body，但 return 的 getFunctionParent 指向声明）
 * @param fnPath  当前树里对应“该函数自身”的 NodePath（用于 traverse / 代码帧）
 * @param owner   当前树里该函数节点本身（用于排除嵌套函数的 return）
 * @param name    组件名（报错文案用）
 */
function wrapSetupFunction(
  fnNode: any,
  fnPath: any,
  owner: any,
  name?: string,
): void {
  // setup 现在返回 render 函数：原来的 Element 返回类型注解必须剥掉，
  // 否则产物类型与实际返回不符。
  fnNode.returnType = null

  const body = fnNode.body
  if (t.isBlockStatement(body)) {
    fnPath.traverse({
      ReturnStatement(returnPath: any) {
        // 只处理组件函数自身的 return；嵌套函数归各自的 visitor
        if (returnPath.getFunctionParent()?.node !== owner) return
        const argument = returnPath.node.argument
        // 裸 return → return () => null（渲染空）
        if (argument == null) {
          returnPath.node.argument = t.arrowFunctionExpression([], t.nullLiteral())
          return
        }
        // setup 风格已废弃：return 渲染函数编译期直接报错（带代码帧）
        if (isFunctionLiteral(argument)) {
          throw buildSetupStyleError(returnPath, name)
        }
        returnPath.node.argument = t.arrowFunctionExpression([], argument)
      },
    })

    const statements = body.body
    const last = statements[statements.length - 1]
    // 落空收尾：末尾不是 return → 追加 return () => null
    if (!last || !t.isReturnStatement(last)) {
      statements.push(
        t.returnStatement(t.arrowFunctionExpression([], t.nullLiteral())),
      )
    }
    return
  }

  // 箭头 expression body：body 就是返回值
  if (isFunctionLiteral(body)) {
    throw buildSetupStyleError(fnPath, name)
  }
  fnNode.body = t.blockStatement([
    t.returnStatement(t.arrowFunctionExpression([], body)),
  ])
}

/** 生成 defineComponent(fn[, name]) 调用 */
function buildDefineComponentCall(fn: any, name?: string): any {
  const args: any[] = [fn]
  if (name) args.push(t.stringLiteral(name))
  return t.callExpression(t.identifier('defineComponent'), args)
}

/** 文件里是否已存在 defineComponent 导入（任意 import source） */
function hasDefineComponentImport(programNode: any): boolean {
  return programNode.body.some((statement: any) => {
    if (!t.isImportDeclaration(statement)) return false
    return statement.specifiers.some((specifier: any) => {
      if (t.isImportSpecifier(specifier)) {
        const imported = (specifier as any).imported
        return (
          (t.isIdentifier(imported) && imported.name === 'defineComponent') ||
          (t.isStringLiteral(imported) && imported.value === 'defineComponent')
        )
      }
      return t.isIdentifier(specifier.local) && specifier.local.name === 'defineComponent'
    })
  })
}

/**
 * defineComponent 包装 Babel 插件。
 *
 * 用法：`plugins: [wrapComponentsPlugin]` 或
 *       `plugins: [[wrapComponentsPlugin, { importSource: '@actview/runtime-core' }]]`
 */
export default function wrapComponentsPlugin(
  _api?: any,
  options?: WrapComponentsOptions,
): any {
  const importSource = options?.importSource ?? DEFAULT_IMPORT_SOURCE
  // Babel 会跨文件复用同一个插件实例：每次 transform 必须重置。
  let transformed = false

  function makeFunctionExpression(decl: any): any {
    const fn: any = t.functionExpression(
      null,
      decl.params,
      decl.body,
      decl.generator,
      decl.async,
    )
    // 泛型组件（function App<T>(props: T)）：typeParameters 必须跟着内层函数，
    // 否则参数注解里的 T 变成未声明标识符。
    if (decl.typeParameters) fn.typeParameters = decl.typeParameters
    return fn
  }

  return {
    visitor: {
      Program: {
        enter() {
          transformed = false
        },
        exit(path: any) {
          if (!transformed) return
          if (hasDefineComponentImport(path.node)) return
          path.node.body.unshift(
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('defineComponent'),
                  t.identifier('defineComponent'),
                ),
              ],
              t.stringLiteral(importSource),
            ),
          )
        },
      },

      // function App() { return <div /> }
      FunctionDeclaration(path: any) {
        const node = path.node
        if (!node.id || !isComponentName(node.id.name)) return
        // TS 重载/环境声明没有函数体，不处理
        if (node.declare || !node.body) return
        // 具名默认导出交给 ExportDefaultDeclaration 处理（输出 export default ...）
        if (path.parentPath?.isExportDefaultDeclaration?.()) return

        const name = node.id.name
        if (node.generator) throw buildGeneratorError(path, name)

        const fn = makeFunctionExpression(node)
        wrapSetupFunction(fn, path, node, name)
        transformed = true
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(node.id, buildDefineComponentCall(fn, name)),
          ]),
        )
      },

      // const App = () => <div /> / const App = function () {...}
      // （init 可被 as / ! / satisfies 包裹）
      VariableDeclarator(path: any) {
        const node = path.node
        if (!t.isIdentifier(node.id) || !isComponentName(node.id.name)) return
        if (!node.init) return
        // 幂等：init 已是 CallExpression（例如已手动 defineComponent / 上一次产物）
        if (t.isCallExpression(node.init)) return

        const { inner, wrappers } = unwrapTsWrappers(node.init)
        if (!t.isFunctionExpression(inner) && !t.isArrowFunctionExpression(inner)) {
          return
        }

        const name = node.id.name
        if (inner.generator) throw buildGeneratorError(path, name)

        // 定位断言链内层的函数 NodePath（traverse / 代码帧用）
        let fnPath = path.get('init')
        while (isTsWrapper(fnPath.node)) fnPath = fnPath.get('expression')

        wrapSetupFunction(inner, fnPath, inner, name)
        transformed = true
        // 断言重新套在 defineComponent 调用外：((() => x) as F)! → (defineComponent(...) as F)!
        node.init = reapplyTsWrappers(buildDefineComponentCall(inner, name), wrappers)
      },

      // export default () => <div /> / function App() {...}
      ExportDefaultDeclaration(path: any) {
        const node = path.node
        const declaration = node.declaration
        // 幂等：已包装过的默认导出
        if (t.isCallExpression(declaration)) return

        if (t.isFunctionDeclaration(declaration)) {
          // TS 重载/环境声明没有函数体，不处理
          if (declaration.declare || !declaration.body) return
          const name: string | undefined = declaration.id?.name
          if (declaration.generator) {
            throw buildGeneratorError(path.get('declaration'), name)
          }
          const fn = makeFunctionExpression(declaration)
          // 匿名默认导出不传 name；具名默认导出用其函数名
          wrapSetupFunction(fn, path.get('declaration'), declaration, name || undefined)
          transformed = true
          node.declaration = buildDefineComponentCall(fn, name || undefined)
          return
        }

        if (
          t.isFunctionExpression(declaration) ||
          t.isArrowFunctionExpression(declaration)
        ) {
          const name: string | undefined = t.isFunctionExpression(declaration)
            ? declaration.id?.name
            : undefined
          if (declaration.generator) {
            throw buildGeneratorError(path.get('declaration'), name)
          }
          const declarationPath = path.get('declaration')
          wrapSetupFunction(declaration, declarationPath, declaration, name)
          transformed = true
          node.declaration = buildDefineComponentCall(declaration, name)
        }
      },
    },
  }
}

export { wrapComponentsPlugin }
