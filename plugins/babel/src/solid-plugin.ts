// ============================================================
// solid-plugin.ts — <solid> 双模细粒度编译（独立插件，职责分离）
// 主插件（defineComponentPlugin）只把 <solid> 块序列化为源码字符串：
//   _jsx('solid', { children: ['rows.map(row => <tr>...</tr>)'] })
// 本插件识别该标记 → parse 字符串 → 二次编译为 solid 产物：
//   solidGet(holder, (container) => { ...DOM 创建 + createEffect + mapArray... })
// holder（setup 级 const）缓存 solid vnode —— render 重跑不重建块。
// 通过 createBabelTransform([defineComponentPlugin, solidPlugin]) 接入。
// ============================================================

import { types as t, parseSync } from '@babel/core'

let solidVarCounter = 0

export default function solidPlugin() {
  let usedSolid = false

  return {
    visitor: {
      Program: {
        enter() {
          // babel 缓存函数插件实例（同引用复用）：每次 transform 必须重置
          usedSolid = false
          solidVarCounter = 0
        },
        exit(path: any) {
          // 主插件生成 _jsx('solid', ...) 的替换节点不会触发本插件的 visitor——
          // Program exit 统一遍历处理
          path.traverse({
            CallExpression(p: any) {
              handleSolidCall(p, () => {
                usedSolid = true
              })
            },
          })
          if (!usedSolid) return
          const hasImport = path.node.body.some(
            (n: any) =>
              t.isImportDeclaration(n) &&
              n.source.value === '@actview/core' &&
              n.specifiers.some((s: any) => s.imported?.name === 'solidGet'),
          )
          if (!hasImport) {
            path.node.body.unshift(
              t.importDeclaration(
                ['solidGet', 'createEffect', 'mapArray'].map((n) =>
                  t.importSpecifier(t.identifier(n), t.identifier(n)),
                ),
                t.stringLiteral('@actview/core'),
              ),
            )
          }
        },
      },
    },
  }
}

/** 识别并编译 _jsx('solid', { children: [源码字符串] }) */
function handleSolidCall(path: any, markUsed: () => void) {
  const node = path.node
  // _jsx('solid', { children: ['源码字符串'] })
  if (!(t.isIdentifier(node.callee) && /^_?jsx/.test(node.callee.name))) return
  if (!(node.arguments[0] && t.isStringLiteral(node.arguments[0], { value: 'solid' }))) return
  const propsObj = node.arguments[1]
  if (!t.isObjectExpression(propsObj)) return
  const childrenProp = propsObj.properties.find(
    (p) => t.isObjectProperty(p) && t.isStringLiteral(p.key, { value: 'children' }),
  )
  if (!childrenProp || !t.isArrayExpression((childrenProp as any).value)) return
  const srcs: string[] = []
  for (const e of (childrenProp as any).value.elements) {
    if (e && t.isStringLiteral(e)) srcs.push(e.value)
  }
  if (srcs.length === 0 || srcs.every((s) => !s.trim())) return

  // ---- 二次编译：逐项 parse 源码字符串 → DOM 创建语句 ----
  const counter = { n: 0 }
  const stmts: any[] = []
  try {
    for (const src of srcs) {
      const ast = parseSync(src, { parserOpts: { plugins: ['jsx', 'typescript'] } })
      if (!ast) return
      for (const st of ast.program.body) {
        if (t.isExpressionStatement(st)) {
          compileSolidTop(st.expression, t.identifier('container'), stmts, counter)
        } else {
          stmts.push(st as any) // 变量声明等：原样保留（块内作用域）
        }
      }
    }
  } catch (e) {
    console.error('[solid-plugin] compile error:', (e as Error)?.message)
    return // parse 失败：保留原样
  }
  if (stmts.length === 0) return

  markUsed()
  const holderId = t.identifier('_solid' + '$$' + ++solidVarCounter)

  // holder 持久化：插入组件 setup 函数体（render 外层）；无函数上下文时插文件顶部
  const renderFn = path.getFunctionParent()
  const setupFn = renderFn && renderFn.getFunctionParent()
  const holderDecl = t.variableDeclaration('const', [
    t.variableDeclarator(holderId, t.objectExpression([])),
  ])
  if (setupFn && t.isFunction(setupFn.node)) {
    setupFn.get('body').unshiftContainer('body', holderDecl)
  } else {
    const prog = path.findParent((p: any) => p.isProgram())
    prog?.unshiftContainer('body', holderDecl)
  }

  // 替换为 solidGet(holder, (container) => {...})
  path.replaceWith(
    t.callExpression(t.identifier('solidGet'), [
      holderId,
      t.arrowFunctionExpression(
        [t.identifier('container')],
        t.blockStatement(stmts),
      ),
    ]),
  )
}

/** 编译块内顶层表达式（map 调用 / JSX 元素 / 动态值） */
function compileSolidTop(expr: any, containerVar: any, stmts: any[], counter: { n: number }): any {
  if (t.isJSXElement(expr)) {
    return compileSolidElement(expr, stmts, counter)
  }
  if (t.isJSXFragment(expr)) {
    compileSolidChildren(expr.children, containerVar, stmts, counter)
    return null
  }
  const mapCall = matchMapCall(expr)
  if (mapCall) {
    stmts.push(
      t.expressionStatement(
        t.callExpression(t.identifier('mapArray'), [
          t.arrowFunctionExpression([], mapCall.listExpr),
          containerVar,
          compileMapArrow(mapCall.arrow, counter),
        ]),
      ),
    )
    return null
  }
  // 其他表达式：动态文本节点（createEffect 直连）
  const textVar = t.identifier('_t' + ++counter.n)
  stmts.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        textVar,
        t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('createTextNode')), [
          t.stringLiteral(''),
        ]),
      ),
    ]),
  )
  stmts.push(
    t.expressionStatement(
      t.callExpression(t.identifier('createEffect'), [
        t.arrowFunctionExpression(
          [],
          t.assignmentExpression(
            '=',
            t.memberExpression(textVar, t.identifier('textContent')),
            expr,
          ),
        ),
      ]),
    ),
  )
  stmts.push(appendStmt(containerVar, textVar))
  return null
}

/** 编译块内 children 序列（追加进 stmts） */
function compileSolidChildren(children: any[], containerVar: any, stmts: any[], counter: { n: number }) {
  for (const c of children) {
    if (t.isJSXText(c)) {
      if (c.value.trim() === '') continue
      const textVar = t.identifier('_t' + ++counter.n)
      stmts.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            textVar,
            t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('createTextNode')), [
              t.stringLiteral(c.value),
            ]),
          ),
        ]),
      )
      stmts.push(appendStmt(containerVar, textVar))
    } else if (t.isJSXExpressionContainer(c)) {
      const expr = c.expression
      if (t.isJSXEmptyExpression(expr)) continue
      const mapCall = matchMapCall(expr)
      if (mapCall) {
        stmts.push(
          t.expressionStatement(
            t.callExpression(t.identifier('mapArray'), [
              t.arrowFunctionExpression([], mapCall.listExpr),
              containerVar,
              compileMapArrow(mapCall.arrow, counter),
            ]),
          ),
        )
      } else {
        // 动态文本节点 + createEffect 直连
        const textVar = t.identifier('_t' + ++counter.n)
        stmts.push(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              textVar,
              t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('createTextNode')), [
                t.stringLiteral(''),
              ]),
            ),
          ]),
        )
        stmts.push(
          t.expressionStatement(
            t.callExpression(t.identifier('createEffect'), [
              t.arrowFunctionExpression(
                [],
                t.assignmentExpression(
                  '=',
                  t.memberExpression(textVar, t.identifier('textContent')),
                  expr,
                ),
              ),
            ]),
          ),
        )
        stmts.push(appendStmt(containerVar, textVar))
      }
    } else if (t.isJSXElement(c)) {
      const elVar = compileSolidElement(c, stmts, counter)
      stmts.push(appendStmt(containerVar, elVar))
    } else if (t.isJSXFragment(c)) {
      compileSolidChildren(c.children, containerVar, stmts, counter)
    }
  }
}

/** 编译 solid 元素：创建 DOM + 属性/事件/children，返回元素变量 */
function compileSolidElement(el: any, stmts: any[], counter: { n: number }): any {
  const name = el.openingElement.name
  const tag = t.isJSXIdentifier(name) ? name.name : (name as any).name
  const elVar = t.identifier('_el' + ++counter.n)
  stmts.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        elVar,
        t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('createElement')), [
          t.stringLiteral(tag),
        ]),
      ),
    ]),
  )

  for (const attr of el.openingElement.attributes) {
    if (!t.isJSXAttribute(attr)) continue
    const attrName = (attr.name as any).name
    if (attrName === 'key' || attrName === 'ref' || attrName === 'v-memo') continue
    // 事件：onXxx → addEventListener（绑定一次，闭包捕获）
    if (/^on[A-Z]/.test(attrName)) {
      const evt = attrName[2].toLowerCase() + attrName.slice(3)
      const handler = (attr.value as any)?.expression ?? attr.value ?? t.identifier('undefined')
      stmts.push(
        t.expressionStatement(
          t.callExpression(t.memberExpression(elVar, t.identifier('addEventListener')), [
            t.stringLiteral(evt),
            handler,
          ]),
        ),
      )
      continue
    }
    if (attr.value && t.isJSXExpressionContainer(attr.value)) {
      // 动态属性：createEffect(() => el.setAttribute(name, expr))——连字符属性名安全
      stmts.push(
        t.expressionStatement(
          t.callExpression(t.identifier('createEffect'), [
            t.arrowFunctionExpression(
              [],
              t.callExpression(t.memberExpression(elVar, t.identifier('setAttribute')), [
                t.stringLiteral(attrName),
                (attr.value as any).expression,
              ]),
            ),
          ]),
        ),
      )
    } else {
      // 静态属性：el.setAttribute(name, value)——连字符属性名安全
      const value = attr.value
        ? t.isStringLiteral(attr.value)
          ? attr.value.value
          : true
        : true
      stmts.push(
        t.expressionStatement(
          t.callExpression(t.memberExpression(elVar, t.identifier('setAttribute')), [
            t.stringLiteral(attrName),
            value === true ? t.stringLiteral('true') : t.stringLiteral(value),
          ]),
        ),
      )
    }
  }

  compileSolidChildren(el.children, elVar, stmts, counter)
  return elVar
}

/** appendChild(container, child) 语句 */
function appendStmt(containerVar: any, childVar: any) {
  return t.expressionStatement(
    t.callExpression(t.memberExpression(containerVar, t.identifier('appendChild')), [childVar]),
  )
}

/** 识别 X.map(箭头) 调用 → { listExpr: X, arrow }；否则 null */
function matchMapCall(expr: any): { listExpr: any; arrow: any } | null {
  if (
    t.isCallExpression(expr) &&
    t.isMemberExpression(expr.callee) &&
    t.isIdentifier(expr.callee.property, { name: 'map' }) &&
    expr.arguments.length === 1 &&
    t.isArrowFunctionExpression(expr.arguments[0])
  ) {
    return { listExpr: expr.callee.object, arrow: expr.arguments[0] }
  }
  return null
}

/** 编译 map 箭头体（(row) => <tr/> → (row) => { 建 el; return el }） */
function compileMapArrow(arrow: any, counter: { n: number }): any {
  const stmts: any[] = []
  const bodyExpr = arrow.body
  if (t.isJSXElement(bodyExpr)) {
    const elVar = compileSolidElement(bodyExpr, stmts, counter)
    stmts.push(t.returnStatement(elVar))
    return t.arrowFunctionExpression(arrow.params, t.blockStatement(stmts))
  }
  if (t.isJSXFragment(bodyExpr)) {
    return arrow
  }
  return arrow
}
