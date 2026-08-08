// ============================================================
// Babel 插件
//   function X() { return <JSX /> }
//   → const X = defineComponent(function() { return () => <JSX /> })
// 并在文件顶部自动注入 defineComponent 的 import
// ============================================================

import { types as t } from '@babel/core'

// ============================================================
// 具名插槽转换
//   <Card>
//     <template slot="header">标题</template>              → slots.header = () => '标题'
//     <template slot="item" item><b>{item}</b></template>  → slots.item = (item) => <b>...
//     默认内容                                            → props.children
//   </Card>
//   转换后：<Card slots={{ header: () => ..., item: (item) => ... }}>默认内容</Card>
//   - 仅当父元素是组件（首字母大写）时提取
//   - 作用域参数：template 上的无值属性名（如 `item`）声明为插槽函数参数
// ============================================================

/** 从 JSXElement 提取 <template slot="name"> 子元素，生成 slots prop */
function extractNamedSlots(el: any) {
  // 仅组件（大写开头）接受具名插槽
  const nameNode = el.openingElement.name
  if (!t.isJSXIdentifier(nameNode) || !/^[A-Z]/.test(nameNode.name)) return

  const children = el.children
  const slotProps: any[] = []
  const remaining: any[] = []

  for (const child of children) {
    if (
      t.isJSXElement(child) &&
      t.isJSXIdentifier(child.openingElement.name, { name: 'template' })
    ) {
      const attrs = child.openingElement.attributes
      const slotAttr = attrs.find(
        (a: any) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'slot' }),
      )
      // 仅转换字符串 slot 值（如 slot="header"）
      if (slotAttr && t.isStringLiteral((slotAttr as any).value)) {
        // 作用域参数：除 slot 外的无值属性名（<template slot="item" item>）
        const scopeParams = attrs
          .filter(
            (a: any) =>
              t.isJSXAttribute(a) &&
              !t.isJSXIdentifier(a.name, { name: 'slot' }) &&
              !a.value,
          )
          .map((a: any) => t.identifier(a.name.name))
        // 插槽内容统一用 Fragment 包裹（JSXText/多 children 均可作箭头函数 body）
        const slotBody = t.jsxFragment(
          t.jsxOpeningFragment(),
          t.jsxClosingFragment(),
          child.children,
        )
        slotProps.push(
          t.objectProperty(
            t.stringLiteral((slotAttr as any).value.value),
            t.arrowFunctionExpression(scopeParams, slotBody),
          ),
        )
        continue // 从 children 中移除 template
      }
    }
    remaining.push(child)
  }

  if (!slotProps.length) return
  el.children = remaining
  el.openingElement.attributes.push(
    t.jsxAttribute(
      t.jsxIdentifier('slots'),
      t.jsxExpressionContainer(t.objectExpression(slotProps)),
    ),
  )
}

/** 递归遍历 JSX 树（元素/Fragment/表达式嵌套），提取具名插槽 */
function walkJSX(node: any) {
  if (t.isJSXElement(node)) {
    extractNamedSlots(node)
    node.children.forEach(walkJSX)
  } else if (t.isJSXFragment(node)) {
    node.children.forEach(walkJSX)
  } else if (t.isJSXExpressionContainer(node)) {
    walkExpression(node.expression)
  }
}

/** 递归遍历可能嵌套 JSX 的表达式（&& / 三元 / 箭头函数 / 数组 / 调用参数等） */
function walkExpression(expr: any) {
  if (!expr) return
  if (t.isJSXElement(expr) || t.isJSXFragment(expr)) {
    walkJSX(expr)
  } else if (t.isJSXExpressionContainer(expr)) {
    walkExpression(expr.expression)
  } else if (t.isLogicalExpression(expr) || t.isBinaryExpression(expr)) {
    walkExpression(expr.left)
    walkExpression(expr.right)
  } else if (t.isConditionalExpression(expr)) {
    walkExpression(expr.consequent)
    walkExpression(expr.alternate)
  } else if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
    walkExpression(expr.body)
  } else if (t.isCallExpression(expr)) {
    expr.arguments.forEach(walkExpression)
  } else if (t.isArrayExpression(expr)) {
    expr.elements.forEach(walkExpression)
  } else if (t.isObjectExpression(expr)) {
    expr.properties.forEach((p: any) => walkExpression(p.value))
  }
}

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
              n.specifiers.some(
                (s: any) => s.imported?.name === 'defineComponent',
              ),
          )
          if (alreadyImported) return

          // 添加 import { defineComponent } from '@actview/core'
          path.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(t.identifier('defineComponent'), t.identifier('defineComponent'))],
              t.stringLiteral('@actview/core'),
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

        // ---------- 2. 包装为 defineComponent（含 setup 风格 / 具名插槽） ----------
        const fn = t.functionExpression(null, node.params, node.body, false, false)
        const call = wrapComponentFn(fn)
        if (!call) return

        hasTransformed = true
        // 函数体内早退 return JSX/null → 包成 render 函数（替换前遍历原 path）
        wrapEarlyReturns(path)

        // ---------- 3. const X = defineComponent(...) ----------
        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(node.id, call),
          ]),
        )
      },
      // 缺陷 2 修复：函数表达式 / 箭头函数组件
      //   const X = function (props) {...}
      //   const X = (props) => <JSX>  /  (props) => { ...; return function(){...} }
      VariableDeclarator(path: any) {
        const node = path.node
        const id = node.id
        if (!t.isIdentifier(id) || !/^[A-Z]/.test(id.name)) return
        const init = node.init
        const isFn =
          t.isFunctionExpression(init) || t.isArrowFunctionExpression(init)
        if (!isFn) return
        // 手动 defineComponent 包装的跳过（init 是 call，非函数）
        const call = wrapComponentFn(init)
        if (!call) return

        hasTransformed = true
        const initPath = path.get('init')
        wrapEarlyReturns(initPath)

        node.init = call
      },
      // 顺带支持：export default (props) => <JSX>（默认导出箭头/函数/匿名函数组件）
      ExportDefaultDeclaration(path: any) {
        const decl = path.node.declaration
        const isFn =
          t.isFunctionExpression(decl) ||
          t.isArrowFunctionExpression(decl) ||
          // export default function() {...}（匿名函数声明）
          t.isFunctionDeclaration(decl)
        if (!isFn) return
        // FunctionDeclaration 不是 Expression（CallExpression 参数类型不符），
        // 转成 FunctionExpression 再包装（共享 body，wrapComponentFn 改动生效）
        const fn = t.isFunctionDeclaration(decl)
          ? t.functionExpression(null, decl.params, decl.body, false, false)
          : decl
        const call = wrapComponentFn(fn)
        if (!call) return

        hasTransformed = true
        const declPath = path.get('declaration')
        wrapEarlyReturns(declPath)

        path.node.declaration = call
      },
    },
  }
}

/**
 * 判断并包装组件函数，返回 defineComponent(...) 调用节点；非组件返回 null。
 * 支持的组件函数形态（__setup 契约）：
 *   1. 直接 return JSX（简写）：function X() { return <JSX/> }
 *   2. 直接 return _jsx(...)（JSX 已被 rolldown/esbuild 降级）
 *   3. return 渲染函数（setup 风格）：function X() { ...; return function() { return <JSX/> } }
 * 处理：
 *   - 形态 1/2：最后 return 包成 () => <JSX>（__setup 返回 render 函数）
 *   - 形态 3：原样保留（__setup 直接返回渲染函数是合法形态）
 *   - 箭头函数 expression body（() => <JSX>）：包成 { return () => <JSX> }
 *   - 具名插槽提取：仅源码 JSX 形态（含 expression body）
 */
function wrapComponentFn(fn: any): any | null {
  const body = fn.body
  const isExprBody = !t.isBlockStatement(body)
  let last: any = null
  let ret: any
  if (isExprBody) {
    // 箭头函数 expression body：body 就是返回值
    ret = body
  } else {
    const stmts = body.body
    if (stmts.length === 0) return null
    last = stmts[stmts.length - 1]
    if (!t.isReturnStatement(last)) return null
    ret = last.argument
    if (ret == null) return null
  }

  const isJsx = t.isJSXElement(ret) || t.isJSXFragment(ret)
  // esbuild/rolldown automatic runtime 已把 JSX 转成 _jsx()/_jsxs() 调用
  // （rolldown-vite 的 rust 转换先于 enforce:'pre' 插件执行时，Babel 收到
  //   的是转换后代码；同样视为组件，包裹 defineComponent）
  const isJsxCall =
    t.isCallExpression(ret) && t.isIdentifier(ret.callee) && /^_?jsx/.test(ret.callee.name)
  // 缺陷 1 修复：setup 风格 —— 最后 return 渲染函数（函数表达式/箭头函数）
  const isRenderFn =
    t.isFunctionExpression(ret) || t.isArrowFunctionExpression(ret)
  // 结尾 return null：条件渲染组件（`if (c) return <JSX/>; return null`）
  // 的合法收尾，__setup 返回 () => null 渲染空（与早退 return null 一致）
  const isNullRet = t.isNullLiteral(ret)
  if (!isJsx && !isJsxCall && !isRenderFn && !isNullRet) return null

  // 具名插槽转换（提取 <template slot="x"> → slots prop）——
  // 仅对源码 JSX 生效（含箭头 expression body；已转换的 _jsx() 调用中无 JSX 节点）
  if (isJsx) walkJSX(ret)

  // return JSX → return () => JSX（__setup 返回 render 函数）
  if (isExprBody) {
    // () => <JSX>  →  () => { return () => <JSX> }
    fn.body = t.blockStatement([
      t.returnStatement(t.arrowFunctionExpression([], ret)),
    ])
  } else if (isJsx || isJsxCall) {
    last.argument = t.arrowFunctionExpression([], ret)
  } else if (isNullRet) {
    // return null → return () => null（渲染空）
    last.argument = t.arrowFunctionExpression([], t.nullLiteral())
  }
  // isRenderFn：原样保留（__setup 直接返回渲染函数是合法形态）

  return t.callExpression(t.identifier('defineComponent'), [fn])
}

/**
 * 把组件函数体内所有「直接 return JSX / _jsx() / null」的语句包成 render 函数
 * （早退 return，可能在 if/switch/循环内部）——否则 __setup() 早退返回
 * 非函数 =》 instance.render is not a function。仅处理函数体自身的 return
 * （排除嵌套函数，子组件由各自的 visitor 处理）。
 */
function wrapEarlyReturns(fnPath: any) {
  fnPath.traverse({
    ReturnStatement(innerPath: any) {
      if (innerPath.getFunctionParent() !== fnPath) return
      const arg = innerPath.node.argument
      if (arg == null) return
      const isStmtJsx = t.isJSXElement(arg) || t.isJSXFragment(arg)
      const isStmtJsxCall =
        t.isCallExpression(arg) &&
        t.isIdentifier(arg.callee) &&
        /^_?jsx/.test(arg.callee.name)
      const isStmtNull = t.isNullLiteral(arg)
      if (isStmtJsx || isStmtJsxCall || isStmtNull) {
        innerPath.node.argument = t.arrowFunctionExpression([], arg)
      }
    },
  })
}
