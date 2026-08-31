// ============================================================
// auto-define-component — React 函数组件语义（自动包装）
//
//   function App(props) { return () => <JSX/> }   （setup 返回 render）
//   const App = (props) => <JSX/>                  （箭头 expression body）
//   function App(props) { return <JSX/> }          （直接返回 JSX 简写）
//
//   → const App = defineComponent(function App(props) { ... })
//     （直接 return JSX 的形态包成 render：return () => <JSX/>）
//
//   defineComponent 来自 actview（选项 defineComponentSource，默认 'actview'），
//   其桥接层提供 props.children（React 语义）。
//
//   检测：PascalCase 命名 + 函数体含 JSX（enter 时检测——JSX 尚未转换，
//   exit 时包装——JSX 已转为 _createVNode 调用）。
// ============================================================

import * as t from '@babel/types'
import type { NodePath } from '@babel/core'

const COMPONENT_RE = /^[A-Z]/

/** 节点树中是否含 JSX（转换前检测用） */
function hasJSX(node: any): boolean {
  let found = false
  const visit = (n: any) => {
    if (found || !n || typeof n !== 'object') return
    if (t.isJSXElement(n) || t.isJSXFragment(n)) {
      found = true
      return
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra' || key === 'comments' || key === 'leadingComments' || key === 'innerComments' || key === 'trailingComments') continue
      const v = (n as any)[key]
      if (Array.isArray(v)) {
        for (const item of v) visit(item)
      } else if (v && typeof v === 'object') {
        visit(v)
      }
    }
  }
  visit(node)
  return found
}

/**
 * 函数体「最后 return 直接是 VNode 调用」→ 包成 render 函数。
 * 组件契约：setup 必须返回 render（`return () => <JSX/>`）；
 * 直接 `return <JSX/>` 的简写在此转成 `return () => <JSX/>`。
 */
function ensureRenderReturn(body: t.BlockStatement) {
  for (let i = body.body.length - 1; i >= 0; i--) {
    const stmt = body.body[i]
    if (!t.isReturnStatement(stmt) || !stmt.argument) continue
    const arg = stmt.argument
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      return // 已是 render 函数
    }
    if (t.isCallExpression(arg) || t.isJSXElement(arg)) {
      // JSX 转换后是 _createVNode(...) 调用；转换前（异常路径）是 JSXElement
      stmt.argument = t.arrowFunctionExpression([], arg)
    }
    return
  }
}

/** 构造 defineComponent(fn) 调用 */
function buildDefineComponentCall(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): t.CallExpression {
  let expr: t.FunctionExpression | t.ArrowFunctionExpression
  if (t.isFunctionDeclaration(fn)) {
    expr = t.functionExpression(fn.id, fn.params, fn.body, fn.generator, fn.async)
    expr.typeParameters = (fn as any).typeParameters
  } else {
    expr = fn
  }
  // 箭头函数 expression body（`() => <JSX/>`）：包一层 render——
  // defineComponent(() => () => <JSX/>)
  if (t.isArrowFunctionExpression(expr) && !t.isBlockStatement(expr.body)) {
    expr.body = t.arrowFunctionExpression([], expr.body)
  } else if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
    ensureRenderReturn(expr.body as t.BlockStatement)
  }
  return t.callExpression(t.identifier('defineComponent'), [expr])
}

export interface AutoDefineComponentState {
  usedDefineComponent: boolean
}

export function createAutoDefineVisitor(state: AutoDefineComponentState) {
  return {
    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>) {
        const id = path.node.id
        if (!id || !COMPONENT_RE.test(id.name)) return
        if (hasJSX(path.node.body)) {
          path.setData('avComponent', true)
        }
      },
      exit(path: NodePath<t.FunctionDeclaration>) {
        if (!path.getData('avComponent')) return
        const id = path.node.id!
        state.usedDefineComponent = true
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(id, buildDefineComponentCall(path.node)),
          ]),
        )
      },
    },
    VariableDeclarator: {
      enter(path: NodePath<t.VariableDeclarator>) {
        const id = path.node.id
        if (!t.isIdentifier(id) || !COMPONENT_RE.test(id.name)) return
        const init = path.node.init
        if (!init) return
        // 已手动 defineComponent 包装的跳过
        if (
          t.isCallExpression(init) &&
          t.isIdentifier(init.callee) &&
          init.callee.name === 'defineComponent'
        ) {
          return
        }
        if (!t.isFunctionExpression(init) && !t.isArrowFunctionExpression(init)) return
        const body = t.isArrowFunctionExpression(init) && !t.isBlockStatement(init.body)
          ? init.body
          : (init as t.FunctionExpression).body
        if (hasJSX(body)) {
          path.setData('avComponent', true)
        }
      },
      exit(path: NodePath<t.VariableDeclarator>) {
        if (!path.getData('avComponent')) return
        const init = path.node.init!
        state.usedDefineComponent = true
        path.node.init = buildDefineComponentCall(
          init as t.FunctionExpression | t.ArrowFunctionExpression,
        )
      },
    },
    ExportDefaultDeclaration: {
      enter(path: NodePath<t.ExportDefaultDeclaration>) {
        const decl = path.node.declaration
        if (!t.isFunctionDeclaration(decl) && !t.isFunctionExpression(decl) && !t.isArrowFunctionExpression(decl)) return
        const body = t.isArrowFunctionExpression(decl) && !t.isBlockStatement(decl.body)
          ? decl.body
          : (decl as t.FunctionDeclaration).body
        if (hasJSX(body)) {
          path.setData('avComponent', true)
        }
      },
      exit(path: NodePath<t.ExportDefaultDeclaration>) {
        if (!path.getData('avComponent')) return
        const decl = path.node.declaration as t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
        state.usedDefineComponent = true
        path.node.declaration = buildDefineComponentCall(decl)
      },
    },
  }
}
