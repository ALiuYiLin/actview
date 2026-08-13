// ============================================================
// Babel 插件
//   function X() { return <JSX /> }
//   → const X = defineComponent(function() { return () => <JSX /> })
// 并在文件顶部自动注入 defineComponent 的 import
// ============================================================

import { types as t } from '@babel/core'
import generate from '@babel/generator'

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
  const jstate = { usedJsx: false, usedFragment: false }

  return {
    visitor: {
      Program: {
        enter() {
          // babel 缓存函数插件实例（同引用复用）：每次 transform 必须重置状态
          hasTransformed = false
          jstate.usedJsx = false
          jstate.usedFragment = false
        },
        exit(path: any) {
          // JSX 编译：注入 _jsx/_Fragment import（@actview/jsx/jsx-runtime）。
          // 独立于 hasTransformed：手动 defineComponent / 非组件文件也可能含 JSX
          if (jstate.usedJsx) {
            const jsxSpecs: any[] = []
            if (jstate.usedJsx) {
              jsxSpecs.push(t.importSpecifier(t.identifier('_jsx'), t.identifier('jsx')))
            }
            if (jstate.usedFragment) {
              jsxSpecs.push(
                t.importSpecifier(t.identifier('_Fragment'), t.identifier('Fragment')),
              )
            }
            const hasJsxImport = path.node.body.some(
              (n: any) =>
                t.isImportDeclaration(n) &&
                n.source.value === '@actview/jsx/jsx-runtime',
            )
            if (!hasJsxImport) {
              path.node.body.unshift(
                t.importDeclaration(jsxSpecs, t.stringLiteral('@actview/jsx/jsx-runtime')),
              )
            }
          }

          if (!hasTransformed) return
          // 检查是否已有 defineComponent 导入
          const alreadyImported = path.node.body.some(
            (n: any) =>
              t.isImportDeclaration(n) &&
              n.specifiers.some(
                (s: any) => s.imported?.name === 'defineComponent',
              ),
          )
          // 添加 import { defineComponent } from '@actview/core'（放最后：与已有 import 共存）
          if (!alreadyImported) {
            path.node.body.unshift(
              t.importDeclaration(
                [t.importSpecifier(t.identifier('defineComponent'), t.identifier('defineComponent'))],
                t.stringLiteral('@actview/core'),
              ),
            )
          }

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
        // 保留组件名（node.id）：defineComponent 产物存 name，KeepAlive include/exclude 用
        const fn = t.functionExpression(node.id, node.params, node.body, false, false)
        const wrapped = wrapComponentFn(fn)
        if (!wrapped) return
        const call = wrapped

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
        const wrapped = wrapComponentFn(init)
        if (!wrapped) return
        const call = wrapped

        hasTransformed = true
        const initPath = path.get('init')
        wrapEarlyReturns(initPath)

        node.init = call
      },
      // 顺带支持：export default (props) => <JSX>（默认导出箭头/函数/匿名函数组件）
      // JSX 编译：组件转换（含 <solid> 提取）之后剩余 JSX → _jsx 调用
      JSXElement(path: any) {
        const name = path.node.openingElement.name
        if (t.isJSXIdentifier(name) && name.name === 'solid') {
          // <solid> 双模标记：块内 JSX 序列化为源码字符串，交给独立 solid 插件二次编译
          // （职责分离：本插件不混合 solid 编译逻辑）
          path.replaceWith(buildSolidMark(path.node, jstate))
          return
        }
        path.replaceWith(compileJsxElement(path.node, jstate))
      },
      JSXFragment(path: any) {
        path.replaceWith(compileJsxFragment(path.node, jstate))
      },
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
        const wrapped = wrapComponentFn(fn)
        if (!wrapped) return
        const call = wrapped

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
 * 支持的组件函数形态（__setup 契约，仅简写组件——组件嵌套方案已废弃）：
 *   1. 直接 return JSX（简写）：function X() { return <JSX/> }
 *   2. 直接 return _jsx(...)（JSX 已被 rolldown/esbuild 降级）
 *   3. return null 结尾（条件渲染收尾）
 * 处理：
 *   - 形态 1/2：最后 return 包成 () => <JSX>（__setup 返回 render 函数）
 *   - 形态 3：return () => null
 *   - 箭头函数 expression body（() => <JSX>）：包成 { return () => <JSX> }
 *   - 具名插槽提取：仅源码 JSX 形态（含 expression body）
 * 注意：setup 风格（最后 return 渲染函数）不允许——保持裸函数不转换
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
  // 结尾 return null：条件渲染组件（`if (c) return <JSX/>; return null`）
  // 的合法收尾，__setup 返回 () => null 渲染空（与早退 return null 一致）
  const isNullRet = t.isNullLiteral(ret)
  // 结尾 return 三元/逻辑表达式：`return cond ? <A/> : null` / `return cond && <A/>`
  // （React 惯例条件渲染；任一分支含 JSX/_jsx/null 即视为渲染返回）
  const isCondRet = isRenderExpr(ret)
  // 设计约束（2026-08）：只支持简写组件（最后 return JSX / _jsx / null / 三元渲染）。
  // setup 风格（return 渲染函数）不允许——组件嵌套方案已废弃（bug 多），
  // return function(){...} 的组件保持裸函数（不转换）。
  if (!isJsx && !isJsxCall && !isNullRet && !isCondRet) return null

  // 具名插槽转换（提取 <template slot="x"> → slots prop）——
  // 仅对源码 JSX 生效（含箭头 expression body；已转换的 _jsx() 调用中无 JSX 节点）
  if (isJsx) walkJSX(ret)

  // return JSX → return () => JSX（__setup 返回 render 函数）
  if (isExprBody) {
    // () => <JSX>  →  () => { return () => <JSX> }
    fn.body = t.blockStatement([
      t.returnStatement(t.arrowFunctionExpression([], ret)),
    ])
  } else if (isJsx || isJsxCall || isCondRet) {
    last.argument = t.arrowFunctionExpression([], ret)
  } else if (isNullRet) {
    // return null → return () => null（渲染空）
    last.argument = t.arrowFunctionExpression([], t.nullLiteral())
  }

  // 统一函数形态：defineComponent(fn)，props 全量进 setup（TS 类型保证形状）
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
      // 早退 return 三元/逻辑：`if (c) return cond ? <A/> : <B/>`
      const isStmtCond = isRenderExpr(arg)
      if (isStmtJsx || isStmtJsxCall || isStmtNull || isStmtCond) {
        innerPath.node.argument = t.arrowFunctionExpression([], arg)
      }
    },
  })
}

/**
 * 表达式是否含「渲染返回」内容——递归检查三元/逻辑表达式的分支：
 *   - JSXElement / JSXFragment（源码 JSX）
 *   - _jsx() / _jsxs() / _jsxDEV() 调用（JSX 已降级）
 *   - null 分支本身**不触发**：仅在三元中配合 JSX 分支时有效
 *     （`cond ? <A/> : null` 由 JSX 分支触发；`p.ok ? null : p.name`
 *     与 `a && null` 均保持不转换——组件不应返回裸值）
 * 例：`cond ? <A/> : null` ✓、`cond && <A/>` ✓、`a ? <A/> : <B/>` ✓、
 *     `x ? 1 : 2` ✗、`p.v ?? null` ✗、`a && null` ✗
 */
function isRenderExpr(expr: any): boolean {
  if (!expr) return false
  if (t.isJSXElement(expr) || t.isJSXFragment(expr)) return true
  if (
    t.isCallExpression(expr) &&
    t.isIdentifier(expr.callee) &&
    /^_?jsx/.test(expr.callee.name)
  ) {
    return true
  }
  if (t.isConditionalExpression(expr)) {
    // 三元：任一分支是渲染（JSX/_jsx）即触发；null 分支不单独触发
    return isRenderExpr(expr.consequent) || isRenderExpr(expr.alternate)
  }
  if (t.isLogicalExpression(expr)) {
    // `cond && <A/>`：左侧为条件、右侧渲染；`<A/> || <B/>`：双渲染兜底。
    // null 不参与（`a && null` 保持不转换）
    return isRenderExpr(expr.right) || isRenderExpr(expr.left)
  }
  return false
}

// ============================================================
// JSX 编译（块外 JSX → _jsx 调用；v-memo 保留 props 键，jsxFactory 提取）
// <solid> 双模需要 babel 全程处理 JSX（块内建 DOM，块外转 _jsx），
// 否则 esbuild 会把 <solid> 当组件转掉。
// ============================================================

/** 编译 JSX 元素 → _jsx(type, props, key) 调用（无 flag/hoist，等价 esbuild automatic 产物） */
function compileJsxElement(el: any, state: any): any {
  const name = el.openingElement.name
  let typeExpr: any
  if (t.isJSXIdentifier(name)) {
    typeExpr = /^[a-z]/.test(name.name)
      ? t.stringLiteral(name.name)
      : t.identifier(name.name)
  } else if (t.isJSXMemberExpression(name)) {
    typeExpr = jsxMemberToMember(name)
  } else {
    typeExpr = t.stringLiteral(name.name)
  }

  let keyExpr: any = null
  const propEntries: any[] = []
  for (const attr of el.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      propEntries.push(t.spreadElement(attr.argument))
      continue
    }
    const aname = (attr.name as any).name
    let value: any
    if (attr.value == null) {
      value = t.booleanLiteral(true)
    } else if (t.isStringLiteral(attr.value)) {
      value = attr.value
    } else {
      value = (attr.value as any).expression
    }
    if (aname === 'key') {
      keyExpr = t.isStringLiteral(value) ? value : value
      continue
    }
    propEntries.push(t.objectProperty(t.stringLiteral(aname), value))
  }

  // children → props.children
  const children = compileJsxChildren(el.children, state)
  if (children.length === 1) {
    propEntries.push(t.objectProperty(t.stringLiteral('children'), children[0]))
  } else if (children.length > 1) {
    propEntries.push(
      t.objectProperty(t.stringLiteral('children'), t.arrayExpression(children)),
    )
  }

  state.usedJsx = true
  const args: any[] = [typeExpr, t.objectExpression(propEntries)]
  args.push(keyExpr ?? t.identifier('undefined'))
  return t.callExpression(t.identifier('_jsx'), args)
}

/** 编译 JSXFragment → _jsx(_Fragment, { children }) */
function compileJsxFragment(frag: any, state: any): any {
  const children = compileJsxChildren(frag.children, state)
  state.usedJsx = true
  state.usedFragment = true
  const propEntries: any[] = []
  if (children.length === 1) {
    propEntries.push(t.objectProperty(t.stringLiteral('children'), children[0]))
  } else if (children.length > 1) {
    propEntries.push(
      t.objectProperty(t.stringLiteral('children'), t.arrayExpression(children)),
    )
  }
  return t.callExpression(t.identifier('_jsx'), [
    t.identifier('_Fragment'),
    t.objectExpression(propEntries),
    t.identifier('undefined'),
  ])
}

/** 编译 JSX children 序列 → 表达式数组 */
function compileJsxChildren(children: any[], state: any): any[] {
  const out: any[] = []
  for (const c of children) {
    if (t.isJSXText(c)) {
      // 对齐 esbuild 的 JSXText 规则：纯空白跳过；含换行的文本 trim 每行并合并为
      // 单行（'Title!
      // 对齐 esbuild 的 JSXText 规则：
      //  单行 → 原样保留（含行内空格）；含换行 → 首尾边界换行(含缩进)删除、
      //  内部换行折叠为 1 空格、行内空白保留（'hello ' 尾随空格不丢）
      if (c.value.trim() === '') continue
      out.push(t.stringLiteral(processJsxText(c.value)))
    } else if (t.isJSXExpressionContainer(c)) {
      if (t.isJSXEmptyExpression(c.expression)) continue
      out.push(c.expression)
    } else if (t.isJSXElement(c)) {
      const cname = c.openingElement.name
      if (t.isJSXIdentifier(cname) && cname.name === 'solid') {
        // 嵌套 <solid>：序列化标记（编译留给独立 solid 插件）
        out.push(buildSolidMark(c, state))
      } else {
        out.push(compileJsxElement(c, state))
      }
    } else if (t.isJSXFragment(c)) {
      out.push(compileJsxFragment(c, state))
    }
  }
  return out
}

/** JSXMemberExpression（<a.b.C />）→ MemberExpression */
function jsxMemberToMember(name: any): any {
  const obj = t.isJSXMemberExpression(name.object)
    ? jsxMemberToMember(name.object)
    : t.identifier(name.object.name)
  return t.memberExpression(obj, t.identifier(name.property.name))
}

/** JSXText 空白处理（对齐 esbuild automatic 产物） */
function processJsxText(value: string): string {
  if (!value.includes('\n')) return value
  return value
    .replace(/^[ \t]*\n[ \t]*/, '') // 开头边界换行（含缩进）删除
    .replace(/[ \t]*\n[ \t]*$/, '') // 结尾边界换行（含缩进）删除
    .replace(/[ \t]*\n[ \t]*/g, ' ') // 内部换行折叠为 1 空格
}

/** <solid> 块 → _jsx('solid', { children: ['块内 JSX 源码字符串'] })
 * 字符串作为中间产物：由独立的 solid babel 插件识别并二次编译（parse + 编译）。 */
function buildSolidMark(el: any, state: any): any {
  state.usedJsx = true
  const parts: string[] = []
  for (const c of el.children) {
    if (t.isJSXText(c)) {
      if (c.value.trim() === '') continue
      parts.push(c.value)
    } else if (t.isJSXExpressionContainer(c)) {
      if (t.isJSXEmptyExpression(c.expression)) continue
      // 不带大括号：solid 插件 parse 时作为独立表达式（顶层 expression）
      parts.push(generate(c.expression).code)
    } else {
      parts.push(generate(c).code) // JSXElement / JSXFragment 原样源码
    }
  }
  return t.callExpression(t.identifier('_jsx'), [
    t.stringLiteral('solid'),
    t.objectExpression([
      t.objectProperty(
        t.stringLiteral('children'),
        t.arrayExpression(parts.map((p) => t.stringLiteral(p))),
      ),
    ]),
    t.identifier('undefined'),
  ])
}
