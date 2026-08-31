// ============================================================
// auto-define-component — React 函数组件语义（自动包装）
//
//   React 形态组件免手动 defineComponent：
//     function App(props) { return <JSX/> }    （函数声明 + 直接 return JSX）
//     const App = (props) => <JSX/>            （箭头 expression body）
//     export default function App() { ... }    （默认导出）
//
//   → const App = defineComponent(function App(props) { ... })
//     （直接 return JSX 的形态包成 render：return () => <JSX/>）
//
//   ⚠️ 组件契约（vue 模型）：函数体 = setup（只执行一次，ref/生命周期
//   在这里创建）；return 的 JSX = render（每次渲染执行，响应式依赖
//   在此收集）。与 React「函数体每次渲染执行」的差异是 v2 的架构取舍。
//   ⚠️ return () => <JSX/>（setup 返回 render）是【非法写法】——React 里
//   返回函数是非法 child；编译期直接抛错，请写直接 return <JSX/>。
//
//   defineComponent 来自 actview（选项 defineComponentSource，默认 'actview'），
//   其桥接层提供 props.children（React 语义）。
//
//   检测：PascalCase 命名 + 函数体含 JSX（enter 时检测——JSX 尚未转换，
//   exit 时包装——JSX 已转为 _createVNode 调用）。
// ============================================================

import * as t from '@babel/types'
import type { File, NodePath } from '@babel/core'
import { resolveComponentProps } from './resolve-props.ts'

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

/** 非法形态错误消息：setup 返回 render（React 语义禁止） */
const ILLEGAL_RENDER_MSG =
  '非法组件写法：return () => <JSX/>（setup 返回 render）是 vue 形态，React 语义禁止。' +
  '请直接 return <JSX/>（组件函数体 = setup，return 的 JSX 自动包成 render）'

/**
 * 函数体「最后 return 直接是 VNode 调用」→ 包成 render 函数。
 * 组件契约：直接 `return <JSX/>` 的 React 形态在此转成
 * `return () => <JSX/>`（render 每次渲染执行、收集响应式依赖）。
 * ⚠️ 最后 return 是函数（`return () => <JSX/>`）→ 编译期抛错（非法形态）。
 */
function ensureRenderReturn(body: t.BlockStatement, path?: NodePath<any>) {
  for (let i = body.body.length - 1; i >= 0; i--) {
    const stmt = body.body[i]
    if (!t.isReturnStatement(stmt) || !stmt.argument) continue
    const arg = stmt.argument
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      // 非法：setup 返回 render——React 里返回函数是非法 child，v2 直接编译报错
      throw (
        path?.buildCodeFrameError(ILLEGAL_RENDER_MSG) ??
        new Error(`[actview/plugin-jsx] ${ILLEGAL_RENDER_MSG}`)
      )
    }
    if (t.isCallExpression(arg) || t.isJSXElement(arg)) {
      // JSX 转换后是 _createVNode(...) 调用；转换前（异常路径）是 JSXElement
      stmt.argument = t.arrowFunctionExpression([], arg)
      return
    }
    if (t.isConditionalExpression(arg) || t.isLogicalExpression(arg)) {
      // `return cond ? <A/> : <B/>` / `return cond && <A/>`（条件渲染常见形态）：
      // 转换后是三元/逻辑表达式（含 _createVNode 分支）——同样包成 render
      stmt.argument = t.arrowFunctionExpression([], arg)
      return
    }
    return
  }
}

/**
 * React 语义：setup 函数规范化——直接 return JSX（或箭头 expression body
 * 返回 JSX）包成 render。auto-define 包装与显式 defineComponent 共用。
 * ⚠️ 仅在 JSX 转换后（exit 阶段）调用：新建的箭头函数不会被再遍历，
 * 包入的必须是已转换的 _createVNode 调用。
 */
export function normalizeSetupFunction(
  fn: t.FunctionExpression | t.ArrowFunctionExpression,
  path?: NodePath<any>,
) {
  if (t.isArrowFunctionExpression(fn) && !t.isBlockStatement(fn.body)) {
    if (t.isArrowFunctionExpression(fn.body) || t.isFunctionExpression(fn.body)) {
      // 非法：`() => () => <JSX/>`——setup 返回 render
      throw (
        path?.buildCodeFrameError(ILLEGAL_RENDER_MSG) ??
        new Error(`[actview/plugin-jsx] ${ILLEGAL_RENDER_MSG}`)
      )
    }
    // 箭头函数 expression body（`() => <JSX/>`）：包一层 render——
    // defineComponent(() => () => <JSX/>)
    fn.body = t.arrowFunctionExpression([], fn.body)
  } else if (t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) {
    ensureRenderReturn(fn.body as t.BlockStatement, path)
  }
}

/** 构造 defineComponent(fn[, options]) 调用 */
function buildDefineComponentCall(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
  options?: t.ObjectExpression,
  path?: NodePath<any>,
): t.CallExpression {
  let expr: t.FunctionExpression | t.ArrowFunctionExpression
  if (t.isFunctionDeclaration(fn)) {
    expr = t.functionExpression(fn.id, fn.params, fn.body, fn.generator, fn.async)
    expr.typeParameters = (fn as any).typeParameters
  } else {
    expr = fn
  }
  normalizeSetupFunction(expr, path)
  const args: t.Expression[] = [expr]
  if (options) args.push(options)
  return t.callExpression(t.identifier('defineComponent'), args)
}

/**
 * 编译期 props 提取：组件函数第一参有类型注解 →
 * 生成 { props: { ... } } 运行时声明（见 resolve-props.ts）。
 * 不可解析/无注解 → undefined（不注入）。
 */
function buildOptions(
  state: AutoDefineComponentState,
  fn:
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression,
): t.ObjectExpression | undefined {
  if (!state.file) return undefined
  const props = resolveComponentProps(fn, state.file)
  if (!props) return undefined
  return t.objectExpression([
    t.objectProperty(t.identifier('props'), props),
  ])
}

export interface AutoDefineComponentState {
  usedDefineComponent: boolean
  /** Babel File（Program.enter 注入，供 props 类型解析） */
  file?: File
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
            t.variableDeclarator(
              id,
              buildDefineComponentCall(
                path.node,
                buildOptions(state, path.node),
                path,
              ),
            ),
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
          buildOptions(
            state,
            init as t.FunctionExpression | t.ArrowFunctionExpression,
          ),
          path,
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
        path.node.declaration = buildDefineComponentCall(
          decl,
          buildOptions(state, decl),
          path,
        )
      },
    },
  }
}
