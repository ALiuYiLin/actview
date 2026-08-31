import { addNamed, addNamespace, isModule } from '@babel/helper-module-imports'
import { declare } from '@babel/helper-plugin-utils'
import syntaxJsx from '@babel/plugin-syntax-jsx'
import template from '@babel/template'
import * as t from '@babel/types'
import { createAutoDefineVisitor, normalizeSetupFunction, type AutoDefineComponentState } from './auto-define-component.ts'
import { resolveComponentProps } from './resolve-props.ts'
import sugarFragment from './sugar-fragment.ts'
import transformVueJSX from './transform-vue-jsx.ts'
import type { State, VueJSXPluginOptions } from './interface.ts'
import type {
  NodePath,
  PluginAPI,
  PluginObject,
  PluginPass,
  Visitor,
} from '@babel/core'

export type { VueJSXPluginOptions }

function hasJSX(parentPath: NodePath<t.Program>) {
  return t.traverseFast(parentPath.node, (node) => {
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      return t.traverseFast.stop
    }
  })
}

const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+(\S+)/

const plugin: (
  api: PluginAPI,
  options: VueJSXPluginOptions,
  dirname: string,
) => PluginObject<State & PluginPass> = declare<State, VueJSXPluginOptions>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (api, _opt, _dirname) => {
    const { types } = api
    // React 函数组件语义：自动 defineComponent 包装（默认开启）
    const autoDefine: AutoDefineComponentState = { usedDefineComponent: false }
    const autoDefineVisitor =
      _opt.autoDefineComponent === false
        ? {}
        : createAutoDefineVisitor(autoDefine)
    const defineComponentSource = _opt.defineComponentSource ?? 'actview'
    return {
      name: '@actview/plugin-jsx',
      inherits: syntaxJsx,
      visitor: {
        ...transformVueJSX,
        ...sugarFragment,
        ...autoDefineVisitor,
        CallExpression: {
          // 显式 defineComponent(fn)：React 语义规范化（直接 return JSX
          // 包成 render）+ 提取 props 运行时声明。
          // exit 阶段执行：JSX 已转为 _createVNode 调用，normalize 包入的
          // 是已转换节点（新建箭头函数不会被再次遍历）。
          exit(path, state) {
            // 编译器生成节点（auto-define 注入的 defineComponent，无源码 loc）
            // 跳过：Babel 8 replaceWith 会 requeue 新节点，二次处理会把
            // 已包装的 render（return () => _createVNode(...)）误判为非法形态
            if (path.node.loc == null) return
            const callee = path.node.callee
            if (!t.isIdentifier(callee) || callee.name !== 'defineComponent') {
              return
            }
            // vue 系 import 的 defineComponent（用户显式走 vue 原生）不处理
            const binding = path.scope.getBinding('defineComponent')
            const importSource =
              binding?.path.parentPath?.isImportDeclaration()
                ? (binding.path.parentPath.node as t.ImportDeclaration)
                    .source.value
                : undefined
            if (importSource && /^@?vue(?:\/|$)/.test(importSource)) return

            const fn = path.node.arguments[0]
            if (!fn || !t.isFunction(fn)) return
            if (t.isFunctionExpression(fn) || t.isArrowFunctionExpression(fn)) {
              normalizeSetupFunction(fn, path)
            }
            const propsOption = resolveComponentProps(fn, state.file)
            if (!propsOption) return

            const args = path.node.arguments
            if (args.length < 2) {
              args.push(
                t.objectExpression([
                  t.objectProperty(t.identifier('props'), propsOption),
                ]),
              )
              return
            }
            const second = args[1]
            if (t.isObjectExpression(second)) {
              const hasProps = second.properties.some(
                (p) =>
                  t.isObjectProperty(p) &&
                  t.isIdentifier(p.key) &&
                  p.key.name === 'props',
              )
              if (!hasProps) {
                second.properties.push(
                  t.objectProperty(t.identifier('props'), propsOption),
                )
              }
            } else if (t.isStringLiteral(second)) {
              // defineComponent(fn, 'Name') → { name: 'Name', props }
              args[1] = t.objectExpression([
                t.objectProperty(t.identifier('name'), second),
                t.objectProperty(t.identifier('props'), propsOption),
              ])
            }
            // 其他形态（变量引用等）保守跳过
          },
        },
        Program: {
          enter(path, state) {
            autoDefine.usedDefineComponent = false
            autoDefine.file = state.file
            if (!hasJSX(path)) return
            const importNames = [
              'createVNode',
              'Fragment',
              'resolveComponent',
              'withDirectives',
              'vShow',
              'vModelSelect',
              'vModelText',
              'vModelCheckbox',
              'vModelRadio',
              'vModelText',
              'vModelDynamic',
              'resolveDirective',
              'mergeProps',
              'createTextVNode',
              'isVNode',
            ]
            // createVNode 从 actview import（包装函数：props.children → 第三参，
            // React 对齐）；其余 helper 保持 vue 官方
            const createVNodeSource =
              _opt.createVNodeSource ?? 'actview'
            if (isModule(path)) {
              // import { createVNode } from "actview";（其余 from "vue"）
              const importMap: Record<
                string,
                t.MemberExpression | t.Identifier
              > = {}
              importNames.forEach((name) => {
                state.set(name, () => {
                  if (importMap[name]) {
                    return types.cloneNode(importMap[name])
                  }
                  const identifier = addNamed(
                    path,
                    name,
                    name === 'createVNode' ? createVNodeSource : 'vue',
                    {
                      ensureLiveReference: true,
                    },
                  )
                  importMap[name] = identifier
                  return identifier
                })
              })
              const { enableObjectSlots = true } = state.opts
              if (enableObjectSlots) {
                state.set('@vue/babel-plugin-jsx/runtimeIsSlot', () => {
                  if (importMap.runtimeIsSlot) {
                    return importMap.runtimeIsSlot
                  }
                  const { name: isVNodeName } = state.get(
                    'isVNode',
                  )() as t.Identifier
                  const isSlot = path.scope.generateUidIdentifier('isSlot')
                  const ast = template.ast`
                    function ${isSlot.name}(s) {
                      return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${isVNodeName}(s));
                    }
                  `
                  const lastImport = (path.get('body') as NodePath[]).findLast(
                    (p) => p.isImportDeclaration(),
                  )
                  if (lastImport) {
                    lastImport.insertAfter(ast)
                  }
                  importMap.runtimeIsSlot = isSlot
                  return isSlot
                })
              }
            } else {
              // var _vue = require('vue');
              let sourceName: t.Identifier
              importNames.forEach((name) => {
                state.set(name, () => {
                  if (!sourceName) {
                    sourceName = addNamespace(path, 'vue', {
                      ensureLiveReference: true,
                    }) as t.Identifier
                  }
                  return t.memberExpression(sourceName, t.identifier(name))
                })
              })

              const helpers: Record<string, t.Identifier> = {}

              const { enableObjectSlots = true } = state.opts
              if (enableObjectSlots) {
                state.set('@vue/babel-plugin-jsx/runtimeIsSlot', () => {
                  if (helpers.runtimeIsSlot) {
                    return helpers.runtimeIsSlot
                  }
                  const isSlot = path.scope.generateUidIdentifier('isSlot')
                  const { object: objectName } = state.get(
                    'isVNode',
                  )() as t.MemberExpression
                  const ast = template.ast`
                    function ${isSlot.name}(s) {
                      return typeof s === 'function' || (Object.prototype.toString.call(s) === '[object Object]' && !${
                        (objectName as t.Identifier).name
                      }.isVNode(s));
                    }
                  `

                  const nodePaths = path.get('body') as NodePath[]
                  const lastImport = nodePaths.findLast(
                    (p) =>
                      p.isVariableDeclaration() &&
                      p.node.declarations.some(
                        (d) => (d.id as t.Identifier)?.name === sourceName.name,
                      ),
                  )
                  if (lastImport) {
                    lastImport.insertAfter(ast)
                  }
                  return isSlot
                })
              }
            }

            const {
              opts: { pragma = '' },
              file,
            } = state

            if (pragma) {
              state.set('createVNode', () => t.identifier(pragma))
            }

            if (file.ast.comments) {
              for (const comment of file.ast.comments) {
                const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value)
                if (jsxMatches) {
                  state.set('createVNode', () => t.identifier(jsxMatches[1]))
                }
              }
            }
          },
          exit(path) {
            // React 函数组件语义：注入 defineComponent import（仅自动包装用过时）
            if (!autoDefine.usedDefineComponent) return
            const alreadyImported = (path.node.body as any[]).some(
              (n) =>
                t.isImportDeclaration(n) &&
                n.source.value === defineComponentSource &&
                n.specifiers.some(
                  (s) =>
                    t.isImportSpecifier(s) &&
                    (s.imported as t.Identifier).name === 'defineComponent',
                ),
            )
            if (!alreadyImported) {
              path.node.body.unshift(
                t.importDeclaration(
                  [
                    t.importSpecifier(
                      t.identifier('defineComponent'),
                      t.identifier('defineComponent'),
                    ),
                  ],
                  t.stringLiteral(defineComponentSource),
                ),
              )
            }
          },
        },
      } as Visitor<State>,
    }
  },
)

export default plugin
export { plugin as 'module.exports' }
