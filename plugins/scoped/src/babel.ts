// ============================================================
// Babel 注入插件 — scoped 的核心
// 用法：
//   import './index.css?scoped'
//   function App() {
//     return <div className="x">hi</div>
//   }
// 转换后：
//   import './index.css?scoped'
//   function App() {
//     return <div className="x" data-v-abc12345="">hi</div>
//   }
// 触发条件：文件内只要有带 ?scoped query 的 .css import，该文件内
// **所有** JSX 元素（含嵌套函数/条件渲染）都注入 data-v-<hash>；
// 没有 ?scoped import 则不处理（等价于未开启 scoped）。
// 多个 ?scoped import → 注入多个 hash（每个 hash 对应一个 css 文件）。
// 组件/原生不做编译期区分（组件判定是运行时语义：vnode.type.__setup）：
// 组件元素同样注入 data-v-<hash>=""，由运行时在组件边界把注入形态的
// data-v-*（值为空）合并为 scopedId prop 传给子组件（ActView 无透传，
// 子组件在 props 声明 scopedId?: string 后手动应用，见 core runtime/scopedProps）。
// 兼容两种输入形态（rolldown 的 JSX 转换可能先于本插件执行）：
//   1. 源码 JSX（<div className="x"/>）   → 注入 JSXAttribute
//   2. 已降级 _jsx() 调用（_jsx("div", { className: "x" })）→ props 对象注入属性
// 注入边界：文件级（整文件遍历，含嵌套渲染箭头函数）。
// ============================================================

import { types as t, type PluginObject } from '@babel/core'
import { getHash } from './css.ts'

/** 单个 scoped 信息（一个 ?scoped css import 对应一组属性） */
interface ScopedInfo {
  attr: string // data-v-<hash>
  slotAttr: string // data-v-<hash>-s（:slotted 用）
}

/** 识别自动 JSX 运行时的工厂函数名：jsx/jsxs/jsxDEV/_jsx/_jsxs/_jsxDEV */
const jsxFactoryRE = /^_?jsx(DEV|s)?$/

/** 是否为 scoped CSS import：源以 .css 结尾（可带 query）且 query 含 scoped */
function isScopedCssImport(source: string): boolean {
  if (typeof source !== 'string') return false
  const [pathPart, query] = source.split('?')
  return pathPart.endsWith('.css') && (query ?? '').includes('scoped')
}

export function scopedBabelPlugin(opts: {
  resolveCssPath: (importSource: string) => string
  attrPrefix?: string
}): () => PluginObject {
  const attrPrefix = opts.attrPrefix ?? 'data-v'

  return function babelPlugin() {
    return {
      visitor: {
        Program(programPath: any) {
          // ---------- Pass 1：检测 ?scoped CSS import，收集文件级 attr ----------
          const fileInfos: ScopedInfo[] = []
          programPath.traverse({
            ImportDeclaration(impPath: any) {
              const source: string = impPath.node.source.value
              if (!isScopedCssImport(source)) return
              const absPath = opts.resolveCssPath(source)
              const hash = getHash(absPath)
              const attr = `${attrPrefix}-${hash}`
              const slotAttr = `${attr}-s`
              if (!fileInfos.some(i => i.attr === attr)) {
                fileInfos.push({ attr, slotAttr })
              }
            },
          })

          if (fileInfos.length === 0) return

          // ---------- Pass 2：文件级注入（整文件所有 JSX / _jsx 调用） ----------
          programPath.traverse({
            JSXElement(jsxPath: any) {
              injectJSX(jsxPath, fileInfos)
            },
            CallExpression(callPath: any) {
              injectJsxCall(callPath, fileInfos)
            },
          })
        },
      },
    }
  }
}

/** 判断 JSXElement 是否位于 <template slot="..."> 内（插槽内容，注入 attr + slotAttr） */
function isInsideSlotTemplate(jsxPath: any): boolean {
  return !!jsxPath.findParent((p: any) => {
    if (!p.isJSXElement()) return false
    const el = p.node
    if (!t.isJSXIdentifier(el.openingElement?.name, { name: 'template' })) return false
    return (el.openingElement.attributes || []).some(
      (a: any) =>
        t.isJSXAttribute(a) &&
        t.isJSXIdentifier(a.name, { name: 'slot' }),
    )
  })
}

/** 给 JSXElement 的 opening 属性注入 data-v 属性（去重） */
function addJSXAttr(attributes: any[], name: string) {
  const exists = attributes.some(
    (a: any) =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name, { name }),
  )
  if (!exists) {
    attributes.push(
      t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral('')),
    )
  }
}

/** 注入源码 JSX 形态 */
function injectJSX(jsxPath: any, infos: ScopedInfo[]) {
  const opening = jsxPath.node.openingElement
  if (!opening) return // JSXFragment 无 openingElement
  const attributes = opening.attributes || []
  const inSlot = isInsideSlotTemplate(jsxPath)
  for (const info of infos) {
    addJSXAttr(attributes, info.attr)
    if (inSlot) addJSXAttr(attributes, info.slotAttr)
  }
}

/** 注入已降级 _jsx(type, props) 形态：props 对象加 "data-v-x": "" */
function injectJsxCall(callPath: any, infos: ScopedInfo[]) {
  const callee = callPath.node.callee
  if (!t.isIdentifier(callee) || !jsxFactoryRE.test(callee.name)) return
  let propsArg = callPath.node.arguments[1]
  if (propsArg == null || t.isNullLiteral(propsArg)) {
    // _jsx('div') / _jsx('div', null)：无 props 时创建空对象注入，
    // 避免降级管线静默丢失 scoped
    propsArg = t.objectExpression([])
    callPath.node.arguments[1] = propsArg
  } else if (!t.isObjectExpression(propsArg)) {
    return
  }
  // 插槽内容（位于 _jsx('template', { slot: ... }) 子树内）额外注入 -s 属性，
  // 镜像 JSX 形态的 isInsideSlotTemplate，保证 :slotted() 在 esbuild 先转的管线也可用
  const inSlot = isInsideSlotTemplateCall(callPath)
  for (const info of infos) {
    addObjectProp(propsArg, info.attr)
    if (inSlot) addObjectProp(propsArg, info.slotAttr)
  }
}

/** props 对象加 "<name>": ""（去重） */
function addObjectProp(propsArg: any, name: string) {
  const exists = propsArg.properties.some(
    (p: any) =>
      t.isObjectProperty(p) && t.isStringLiteral(p.key) && p.key.value === name,
  )
  if (!exists) {
    propsArg.properties.push(
      t.objectProperty(t.stringLiteral(name), t.stringLiteral('')),
    )
  }
}

/** 判断 _jsx 调用是否位于 _jsx('template', { slot: ... }) 子树内（插槽内容） */
function isInsideSlotTemplateCall(callPath: any): boolean {
  return !!callPath.findParent((p: any) => {
    if (!p.isCallExpression()) return false
    const callee = p.node.callee
    if (!t.isIdentifier(callee) || !jsxFactoryRE.test(callee.name)) return false
    // type 参数为 'template' 且 props 含 slot 属性
    const typeArg = p.node.arguments[0]
    if (!t.isStringLiteral(typeArg) || typeArg.value !== 'template') return false
    const propsArg = p.node.arguments[1]
    if (!t.isObjectExpression(propsArg)) return false
    return propsArg.properties.some(
      (prop: any) =>
        t.isObjectProperty(prop) &&
        ((t.isStringLiteral(prop.key) && prop.key.value === 'slot') ||
          (t.isIdentifier(prop.key) && prop.key.name === 'slot')),
    )
  })
}
