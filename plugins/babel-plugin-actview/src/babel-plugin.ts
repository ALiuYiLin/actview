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

// ============================================================
// JSX 编译（对齐 automatic runtime + 编译期优化）
//   <td class="col-md-1">{row.id}</td>
//     → _jsx("td", { class: "col-md-1", children: row.id }, undefined, 1 /* TEXT */)
//   <span class="x">static</span>（纯静态子树）
//     → _hoisted_1 = _jsx("span", { class: "x", children: "static" }, undefined, 0)
//       原位置替换为 _hoisted_1（引用短路：整个子树跳过 diff）
//   <tr class={x}>{...}</tr>
//     → _jsx("tr", { class: x, children: [...] }, row.id, 2 /* PROPS */, ["class"])
// 运行时按 __patchFlag 走最小 patch 路径（见 core/renderer 的 patchVNode）。
// ============================================================

/** 运行时 PatchFlag：动态文本 children（更新只写 textContent） */
export const PATCH_TEXT = 1
/** 运行时 PatchFlag：props 含动态属性（__propsKeys 列出，只 patch 这些 key） */
export const PATCH_PROPS = 2

/** JSX 编译会话状态（每次 Program 重置） */
interface JsxState {
  hoistedNodes: t.CallExpression[] // _hoisted_N = 全静态子树
  hoistedKeys: t.ArrayExpression[] // _propsKeys_N = 动态 props 列表（编译期固定，提升为常量避免每次分配）
  usedJsx: boolean // 用到 _jsx
  usedJsxs: boolean // 用到 _jsxs
  usedFragment: boolean // 用到 _Fragment
  injected: boolean // import 已注入（防重复）
}

function createJsxState(): JsxState {
  return { hoistedNodes: [], hoistedKeys: [], usedJsx: false, usedJsxs: false, usedFragment: false, injected: false }
}

/** 表达式是否静态（字面量 / 已 hoist 的引用） */
function isStaticExpr(expr: any): boolean {
  if (!expr) return true
  if (
    t.isStringLiteral(expr) ||
    t.isNumericLiteral(expr) ||
    t.isBooleanLiteral(expr) ||
    t.isNullLiteral(expr)
  ) {
    return true
  }
  // 已 hoist 的静态子树引用（_hoisted_N）
  return t.isIdentifier(expr) && /^_hoisted\d+$/.test(expr.name)
}

/** 子节点列表是否全静态（JSXText / 静态引用 / 字面量表达式） */
function areStaticChildren(children: any[]): boolean {
  for (const c of children) {
    if (t.isJSXText(c)) {
      continue // 文本始终静态
    }
    if (t.isJSXExpressionContainer(c)) {
      if (!isStaticExpr(c.expression)) return false
      continue
    }
    // 已转换的子元素：_jsx 调用（动态性未知，保守按动态）或 hoisted 引用
    if (t.isIdentifier(c) && /^_hoisted\d+$/.test(c.name)) continue
    return false
  }
  return true
}

/** 对齐 esbuild/React 的 JSXText 空白规则：
 * 1. 去掉开头的换行+缩进（^\n\s*）
 * 2. 去掉结尾的缩进+换行（\s*\n$）
 * 3. 内部换行+周围空白折叠为单个空格（\s*\n\s* → ' '）
 * 单行文本（无换行）保留原样（含首尾空格）。
 * 同时解码 HTML 实体（&amp; → & 等），与 esbuild 一致。 */
function processJsxText(value: string): string {
  const decoded = value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  if (!decoded.includes('\n')) return decoded
  // 含换行：开头换行+缩进去掉；结尾"空白+换行+空白"整段去掉
  // （仅空格结尾保留，如 "hello " 后紧跟元素）；内部换行折叠为单空格
  return decoded
    .replace(/^\n\s*/, '')
    .replace(/\s*\n\s*$/, '')
    .replace(/\s*\n\s*/g, ' ')
}

/** JSX 元素 → _jsx/_jsxs 调用（exit 阶段，子元素已先转换）。返回替换节点 */
function compileJsxElement(el: any, state: JsxState): any {
  const name = el.openingElement.name
  // type 表达式：小写标签 → 字符串；大写组件 → 标识符引用；成员表达式 → MemberExpression
  let typeExpr: any
  if (t.isJSXIdentifier(name)) {
    typeExpr = /^[a-z]/.test(name.name) ? t.stringLiteral(name.name) : t.identifier(name.name)
  } else if (t.isJSXMemberExpression(name)) {
    typeExpr = jsxMemberToMember(name)
  } else {
    typeExpr = t.stringLiteral(name.name)
  }

  // key（第三参数，不进入 props）
  let keyExpr: any = null
  const attrs = el.openingElement.attributes
  const keyAttr = attrs.find(
    (a: any) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'key' }),
  )
  if (keyAttr && keyAttr.value) {
    keyExpr = t.isStringLiteral(keyAttr.value)
      ? keyAttr.value
      : (keyAttr.value as any).expression
  }
  const normAttrs = attrs.filter(
    (a: any) => !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: 'key' })),
  )

  // props（attr 们）+ 动态性分析
  const propEntries: any[] = []
  const dynamicKeys: string[] = []
  let hasDynamicAttr = false
  for (const a of normAttrs) {
    if (t.isJSXSpreadAttribute(a)) {
      propEntries.push(t.spreadElement(a.argument))
      hasDynamicAttr = true
    } else {
      const aname = a.name.name
      let value: any
      if (a.value == null) value = t.booleanLiteral(true)
      else if (t.isStringLiteral(a.value)) value = a.value
      else value = (a.value as any).expression // JSXExpressionContainer
      if (a.value && t.isJSXExpressionContainer(a.value)) {
        hasDynamicAttr = true
        if (aname !== 'children') dynamicKeys.push(aname)
      }
      propEntries.push(t.objectProperty(t.stringLiteral(aname), value))
    }
  }

  // children：JSXText → 字符串；表达式 → 原表达式；已转换子元素保持
  const rawChildren = el.children
  const textChildren = rawChildren.filter(
    (c: any) => !(t.isJSXText(c) && c.value.trim() === ''),
  )
  // 动态文本：唯一非空子节点是单个表达式（非 JSX 结构）→ PATCH_TEXT
  let isDynamicText = false
  let childrenExpr: any = null
  const realChildren = textChildren.filter(
    (c: any) => !(t.isJSXExpressionContainer(c) && t.isJSXEmptyExpression(c.expression)),
  )
  if (realChildren.length === 0) {
    childrenExpr = null // 无 children：不生成 children 属性
  } else if (
    realChildren.length === 1 &&
    t.isJSXExpressionContainer(realChildren[0]) &&
    !t.isJSXElement(realChildren[0].expression) &&
    !t.isJSXFragment(realChildren[0].expression)
  ) {
    isDynamicText = true
    childrenExpr = realChildren[0].expression
  } else {
    const items = realChildren.map((c: any) => {
      if (t.isJSXText(c)) return t.stringLiteral(processJsxText(c.value))
      if (t.isJSXExpressionContainer(c)) return c.expression
      return c
    })
    childrenExpr = items.length === 1 ? items[0] : t.arrayExpression(items)
  }

  // 全静态子树才可提升为模块级常量：type 必须是原生元素（字符串标签）——
  // 组件标识符引用无法提升（作用域可能不是模块级，且多实例共享有风险）
  const isWholeStatic =
    !hasDynamicAttr && t.isStringLiteral(typeExpr) && areStaticChildren(realChildren)
  if (isWholeStatic) {
    // 全静态子树 → 模块级 _hoisted_N 常量，引用短路跳过整个 diff
    const call = buildJsxCall(typeExpr, propEntries, childrenExpr, keyExpr, 0, state)
    const id = t.identifier(`_hoisted${state.hoistedNodes.length + 1}`)
    state.hoistedNodes.push(call)
    return id
  }

  // flag：动态 attr → PATCH_PROPS（记录 keys）；动态文本 children → PATCH_TEXT
  let flag = 0
  let propsKeys: string[] | null = null
  if (hasDynamicAttr) {
    flag |= PATCH_PROPS
    if (dynamicKeys.length) propsKeys = dynamicKeys
  }
  if (isDynamicText) flag |= PATCH_TEXT
  return buildJsxCall(typeExpr, propEntries, childrenExpr, keyExpr, flag, state, propsKeys)
}

/** 生成 _jsx/_jsxs(type, props, key?, flag?, propsKeys?) 调用 */
function buildJsxCall(
  typeExpr: any,
  propEntries: any[],
  childrenExpr: any,
  keyExpr: any,
  flag: number,
  state: JsxState,
  propsKeys?: string[] | null,
): t.CallExpression {
  const propsObj = t.objectExpression([...propEntries])
  if (childrenExpr !== null) {
    // children 单值（_jsx 语义）或数组（_jsxs 语义）都进 props.children
    if (t.isArrayExpression(childrenExpr)) {
      state.usedJsxs = true
    } else {
      state.usedJsx = true
    }
    propsObj.properties.push(
      t.objectProperty(t.identifier('children'), childrenExpr),
    )
  } else {
    state.usedJsx = true
  }

  const args: any[] = [typeExpr, propsObj]
  // key 位：无 key 时也显式补 undefined 占位（否则 flag 会错位到第 3 参）
  args.push(keyExpr ?? t.identifier('undefined'))
  // 有编译期信息才传 flag（0 也传：运行时据此跳过静态 props）
  args.push(t.numericLiteral(flag))
  if (propsKeys && propsKeys.length) {
    // 动态 props 列表编译期固定：提升为模块级常量，避免每次 render 分配数组
    state.hoistedKeys.push(t.arrayExpression(propsKeys.map((k) => t.stringLiteral(k))))
    args.push(t.identifier(`_propsKeys${state.hoistedKeys.length}`))
  }

  const callee = t.isArrayExpression(childrenExpr)
    ? t.identifier('_jsxs')
    : t.identifier('_jsx')
  return t.callExpression(callee, args)
}

/** JSXMemberExpression（<a.b.C />）→ MemberExpression */
function jsxMemberToMember(m: any): any {
  const obj = t.isJSXMemberExpression(m.object)
    ? jsxMemberToMember(m.object)
    : t.identifier(m.object.name)
  return t.memberExpression(obj, t.identifier(m.property.name))
}

/** JSXFragment → _jsx(_Fragment, { children }) */
function compileJsxFragment(frag: any, state: JsxState): t.CallExpression {
  state.usedFragment = true
  const textChildren = frag.children.filter(
    (c: any) => !(t.isJSXText(c) && c.value.trim() === ''),
  )
  const realChildren = textChildren.filter(
    (c: any) => !(t.isJSXExpressionContainer(c) && t.isJSXEmptyExpression(c.expression)),
  )
  const items = realChildren.map((c: any) => {
    if (t.isJSXText(c)) return t.stringLiteral(processJsxText(c.value))
    if (t.isJSXExpressionContainer(c)) return c.expression
    return c
  })
  const childrenExpr =
    items.length === 0 ? t.arrayExpression([]) : t.arrayExpression(items)
  state.usedJsxs = true
  return t.callExpression(t.identifier('_jsxs'), [
    t.identifier('_Fragment'),
    t.objectExpression([t.objectProperty(t.identifier('children'), childrenExpr)]),
    t.numericLiteral(0),
  ])
}

/** 注入 jsx/jsxs/Fragment import（Program exit，幂等） */
function injectJsxImport(path: any, state: JsxState) {
  if (state.injected) return
  const body = path.node.body
  const specs: any[] = []
  if (state.usedJsx) specs.push(t.importSpecifier(t.identifier('_jsx'), t.identifier('jsx')))
  if (state.usedJsxs) specs.push(t.importSpecifier(t.identifier('_jsxs'), t.identifier('jsxs')))
  if (state.usedFragment) specs.push(t.importSpecifier(t.identifier('_Fragment'), t.identifier('Fragment')))
  if (!specs.length) return

  const hasImport = body.some(
    (n: any) =>
      t.isImportDeclaration(n) &&
      n.source.value === '@actview/jsx/jsx-runtime' &&
      n.specifiers.some((s: any) => specs.some((x: any) => x.imported.name === s.imported?.name)),
  )
  if (hasImport) return
  state.injected = true
  body.unshift(
    t.importDeclaration(specs, t.stringLiteral('@actview/jsx/jsx-runtime')),
  )
}


export default function defineComponentPlugin() {
  let hasTransformed = false
  let jsxState: JsxState = createJsxState()

  return {
    visitor: {
      Program: {
        enter() {
          hasTransformed = false
          jsxState = createJsxState()
        },
        exit(path: any) {
          // JSX runtime import（若用到 _jsx/_jsxs/_Fragment）
          injectJsxImport(path, jsxState)
          // hoisted 静态子树 / 动态 props 列表常量：插到文件末尾（所有声明之后，避免引用组件标识符的 TDZ）
          if (jsxState.hoistedNodes.length || jsxState.hoistedKeys.length) {
            const decls = jsxState.hoistedNodes.map((call, i) =>
              t.variableDeclaration('const', [
                t.variableDeclarator(t.identifier(`_hoisted${i + 1}`), call),
              ]),
            )
            jsxState.hoistedKeys.forEach((arr, i) => {
              decls.push(
                t.variableDeclaration('const', [
                  t.variableDeclarator(t.identifier(`_propsKeys${i + 1}`), arr),
                ]),
              )
            })
            path.node.body.push(...decls)
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
      // JSX 编译（自底向上：先转换子元素）：
      //   源码 JSX → _jsx/_jsxs 调用（含 __patchFlag / __propsKeys / hoist）
      JSXElement: {
        exit(path: any) {
          path.replaceWith(compileJsxElement(path.node, jsxState))
        },
      },
      JSXFragment: {
        exit(path: any) {
          path.replaceWith(compileJsxFragment(path.node, jsxState))
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

  // 自动 props 白名单：从函数第一个参数的 TS 类型字面量提取属性名
  //   function Component(props: { x1: string, x2: number }) {...}
  //   → defineComponent({ props: ['x1', 'x2'], setup: function(props){...} })
  //   —— 运行时 props/attrs 分离（声明内进 setup.props、声明外进 ctx.attrs）。
  // 无法提取（无类型/any/类型别名引用/参数缺省）时回退函数形态（props 全量）：
  //   esbuild/rolldown 先转后类型已剥离，Babel 拿不到注解 → 自动回退（best-effort）
  const propsKeys = extractPropsFromType(fn)
  if (propsKeys) {
    return t.callExpression(t.identifier('defineComponent'), [
      t.objectExpression([
        t.objectProperty(
          t.identifier('props'),
          t.arrayExpression(propsKeys.map(k => t.stringLiteral(k))),
        ),
        t.objectProperty(t.identifier('setup'), fn),
      ]),
    ])
  }
  return t.callExpression(t.identifier('defineComponent'), [fn])
}

/**
 * 从组件函数第一个参数提取 props 白名单。支持两种来源：
 *   A. TS 类型注解（内联对象类型字面量 TSTypeLiteral）：
 *      `props: { x1: string, x2?: number }` / `{ x1, x2 }: { x1: string, x2: number }` → ['x1', 'x2']
 *   B. 解构参数（无类型注解）：`{ x1, x2 }` → ['x1', 'x2']（属性名即 props 白名单）
 * 回退 null（保持函数形态，props 全量）：
 *   - 无注解且非解构 / any / 类型别名引用（Babel 无类型检查器无法跨文件解析）
 *   - 解构带 rest（`{ x1, ...rest }`）：白名单会让 rest 在运行时拿不到剩余 attrs，
 *     保守回退全量（rest 语义保持）
 *   - esbuild/rolldown 先转后类型与解构已剥离（解构被运行时展开成 props.x1）→ 自动回退
 */
function extractPropsFromType(fn: any): string[] | null {
  const firstParam = fn.params?.[0]
  if (!firstParam) return null

  // A. TS 类型注解（Identifier 或 ObjectPattern 参数都可带）
  const typeAnno = firstParam.typeAnnotation?.typeAnnotation
  if (typeAnno && t.isTSTypeLiteral(typeAnno)) {
    const keys: string[] = []
    for (const member of typeAnno.members) {
      if (!t.isTSPropertySignature(member)) continue
      const name = getKeyName(member.key)
      if (name) keys.push(name)
    }
    if (keys.length) return keys
  }

  // B. 解构参数（无类型注解）：属性名即 props 白名单；
  //    带 rest（{ x1, ...rest }）时保守回退（rest 语义需要全量 props）
  if (t.isObjectPattern(firstParam)) {
    // Babel 8：rest 以 RestElement 存在于 properties 数组（旧版 firstParam.rest 已弃用）
    const hasRest = firstParam.properties.some((p: any) => t.isRestElement(p))
    if (hasRest) return null
    const keys: string[] = []
    for (const prop of firstParam.properties) {
      if (!t.isObjectProperty(prop)) continue
      const name = getKeyName(prop.key)
      if (name) keys.push(name)
    }
    return keys.length ? keys : null
  }

  return null
}

/** 从 JSX/TS 属性 key（Identifier 或 StringLiteral）取属性名；其他形态返回 null */
function getKeyName(key: any): string | null {
  if (t.isIdentifier(key)) return key.name
  if (t.isStringLiteral(key)) return key.value
  return null
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
