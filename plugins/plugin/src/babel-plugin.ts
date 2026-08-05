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

        // ---------- 2. 找 return ----------
        const body = node.body.body
        const last = body[body.length - 1]
        if (!t.isReturnStatement(last)) return
        const ret = last.argument
        // 显式非空收窄（isJsx/isJsxCall 是 boolean 变量，不提供类型守卫，
        // 后续 arrowFunctionExpression/functionExpression 需要非空 Expression）
        if (ret == null) return
        const isJsx = t.isJSXElement(ret) || t.isJSXFragment(ret)
        // esbuild/rolldown automatic runtime 已把 JSX 转成 _jsx()/_jsxs() 调用
        // （rolldown-vite 的 rust 转换先于 enforce:'pre' 插件执行时，Babel 收到
        //   的是转换后代码；同样视为组件，包裹 defineComponent）
        const isJsxCall =
          t.isCallExpression(ret) &&
          t.isIdentifier(ret.callee) &&
          /^_?jsx/.test(ret.callee.name)
        if (!isJsx && !isJsxCall) return

        hasTransformed = true

        // ---------- 2.5 具名插槽转换（提取 <template slot="x"> → slots prop） ----------
        // 仅对源码 JSX 生效；已转换的 _jsx() 调用中无 JSX 节点可提取
        if (isJsx) walkJSX(last.argument)

        // ---------- 3. return JSX → return () => JSX ----------
        last.argument = t.arrowFunctionExpression([], ret)

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
