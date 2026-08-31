// ============================================================
// resolve-props — 编译期 props 提取（React 语义 → Vue 运行时声明）
//
//   React 组件 = 函数，props 声明 = 第一个参数的类型注解：
//     function App(props: { step?: number }) { return () => <JSX/> }
//     const App = (props: CardProps) => <JSX/>
//     function App(props: Props = {}) { ... }            （默认值参数）
//
//   用 @vue/compiler-sfc 的 extractRuntimeProps（与 <script setup>
//   defineProps<T> / 官方 @vue/babel-plugin-resolve-type 同一套逻辑）
//   把类型降级为 Vue 运行时 props 选项：
//     defineComponent(fn, { props: { step: { type: Number, required: false } } })
//
//   有了运行时 props 声明，actview 桥接按「有声明」开启 inheritAttrs：
//   未消费的 attrs（class / data-v-* / 事件 / 透传属性）自动落到根元素，
//   同时 scoped 插件注入的 data-v 对 actview 组件生效。
//
//   ⚠️ children 必须在输出层剔除：React 语义下它是 slots 桥接键，
//      声明进 props 会被 Vue 当 prop 消费，破坏 slots → children 桥接。
//
//   容错：类型不可解析（跨文件引用 / 复杂类型）→ warn 并跳过注入，
//   组件退回「无 props 声明」语义（inheritAttrs false），不阻断编译。
// ============================================================

import { parseExpression } from '@babel/parser'
import type { File } from '@babel/core'
import * as t from '@babel/types'
import {
  extractRuntimeProps,
  type SimpleTypeResolveContext,
} from '@vue/compiler-sfc'

/**
 * 从组件函数提取 props 运行时声明。
 *
 * @param fn  组件函数（auto-define 包装目标或 defineComponent 第一参）
 * @param file Babel File（提供源码 / AST 供类型解析）
 * @returns 可注入 options.props 的对象表达式；不可解析/无注解返回 undefined
 */
export function resolveComponentProps(
  fn:
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression,
  file: File,
): t.ObjectExpression | undefined {
  const first = fn.params[0]
  if (!first) return undefined

  // 默认值参数（props = { ... }）：类型注解在 left 上
  let param: t.Node = first
  if (t.isAssignmentPattern(first)) param = first.left
  if (!t.isIdentifier(param) || !param.typeAnnotation) return undefined
  // Babel 8 的 typeAnnotation 是 TSTypeAnnotation | FlowType 联合——窄化到 TS
  const ann = param.typeAnnotation
  if (!t.isTSTypeAnnotation(ann)) return undefined

  const ctx: SimpleTypeResolveContext = {
    filename: file.opts.filename || 'unknown.jsx',
    source: file.code,
    options: {},
    ast: file.ast.program.body,
    isCE: false,
    warn() {},
    error(msg, node) {
      const loc = node?.loc
        ? ` @${node.loc.start.line}:${node.loc.start.column + 1}`
        : ''
      throw new Error(`props 类型不可解析: ${msg}${loc}`)
    },
    helper: (key) => `_${key}`,
    getString: (node) => file.code.slice(node.start!, node.end!),
    propsTypeDecl: ann.typeAnnotation,
    propsRuntimeDefaults: undefined,
    propsDestructuredBindings: {},
    emitsTypeDecl: undefined,
  }

  let runtimeProps: string | undefined
  try {
    runtimeProps = extractRuntimeProps(ctx)
  } catch (e) {
    // interface extends 跨文件泛型（如 Base UI 的 BaseUIComponentProps）是
    // 常见模式且非用户错误——静默跳过（组件退回无 props 声明语义）；
    // 其余解析失败（跨文件 import 的类型等）保留 warn 提示
    const msg = (e as Error).message
    if (!msg.includes('Failed to resolve extends base type')) {
      console.warn(`[actview/plugin-jsx] 跳过 props 提取：${msg}`)
    }
    return undefined
  }
  if (!runtimeProps) return undefined

  // 输出层剔除 children（slots 桥接键，绝不能进 props 声明）
  const parsed = parseExpression(runtimeProps)
  if (t.isObjectExpression(parsed)) {
    parsed.properties = parsed.properties.filter((p) => {
      if (!t.isObjectProperty(p)) return true
      const key = p.key
      const name = t.isIdentifier(key)
        ? key.name
        : t.isStringLiteral(key)
          ? key.value
          : null
      return name !== 'children'
    })
  }
  return parsed as t.ObjectExpression
}
