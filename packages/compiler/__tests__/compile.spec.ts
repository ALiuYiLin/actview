// ============================================================
// @actview/compiler 端到端（L1 = 组件包装；L2 = 宿主 automatic runtime）
//
// 本包只做 L1：输出仍含 JSX。测试里用 Vite 的 transformWithEsbuild 模拟
// 宿主 automatic runtime（jsx: react-jsx + jsxImportSource @actview/jsx），
// 验证「L1 产物 → 宿主 JSX 降级」整条链路可执行。
// ============================================================

import { describe, expect, it } from 'vitest'
import { parseSync, transformSync } from '@babel/core'
import { transformWithEsbuild } from 'vite'
import { compileComponents } from '../src/index'
import wrapComponentsPlugin from '../src/wrap'
import { defineComponent, isComponent } from '../../runtime-core/src/index.ts'
import { isVNode } from '../../runtime-core/src/internal.ts'
import { Fragment, jsx, jsxs } from '../../jsx/src/jsx-runtime.ts'

const parserOpts = { plugins: ['jsx', 'typescript'] as never[] }

/** 产物里是否还有 JSX 语法节点 */
function hasJsx(code: string): boolean {
  const ast = parseSync(code, { configFile: false, babelrc: false, parserOpts })
  let found = false
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || found) return
    const n = node as Record<string, any>
    if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
      found = true
      return
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue
      const value = n[key]
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(ast?.program)
  return found
}

/** 模拟宿主工具链的 L2：esbuild automatic runtime（@actview/jsx） */
async function lowerJsx(code: string): Promise<string> {
  const result = await transformWithEsbuild(code, 'App.tsx', {
    loader: 'tsx',
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
    target: 'es2020',
    format: 'esm',
  })
  return result.code
}

/** L1 产物（仍含 JSX） */
function wrap(code: string): string {
  return compileComponents(code, { filename: 'App.tsx' })?.code ?? ''
}

const COUNTER = `
function Counter(props) {
  const n = props.start
  return (
    <>
      <button class="btn" onClick={() => props.onInc()}>{n}</button>
    </>
  )
}
`

describe('@actview/compiler：L1 组件包装（输出仍含 JSX）', () => {
  it('组件定义点交付为 defineComponent(setup)，JSX 原样保留', () => {
    const out = wrap(COUNTER)
    expect(out).toContain('const Counter = defineComponent(function (props)')
    expect(out).toContain('"Counter"')
    expect(out).toContain('from "@actview/runtime-core"')
    // L1 不负责 JSX 降级：产物仍是 JSX（由宿主 automatic runtime 处理）
    expect(out).toContain('<button')
    expect(hasJsx(out)).toBe(true)
  })

  it('早退 / 落空 fallback 由 L1 保证（setup 永远返回 render 函数）', () => {
    const out = wrap(`function Maybe(props) { if (props.show) return <div class="x"/> }`)
    expect(out).toContain('if (props.show) return () => <div')
    expect(out).toContain('return () => null')
  })

  it('默认导出 + async setup 保留', () => {
    const out = wrap(`
      export default async function Loader() {
        const data = await fetchData()
        return <div>{data}</div>
      }
    `)
    expect(out).toContain('export default defineComponent(async function')
    expect(out).toContain('"Loader"')
  })

  it('小写函数不是组件：L1 不动它（JSX 交给宿主）', () => {
    const out = wrap(`const renderItem = (item) => <li>{item}</li>`)
    expect(out).not.toContain('defineComponent')
    expect(out).toContain('<li>')
  })

  it('幂等：对已包装产物再次 L1 不重复包装', () => {
    const once = wrap(COUNTER)
    const twice = wrap(once)
    expect(twice.match(/defineComponent\(/g)).toHaveLength(1)
  })

  it('L1 不依赖 JSX：宿主已降级（jsx() 调用）的输入同样能包装', async () => {
    const lowered = await lowerJsx(`function App() { return <div>hi</div> }`)
    expect(hasJsx(lowered)).toBe(false)

    const out = wrap(lowered)
    expect(out).toContain('const App = defineComponent(function')
    // 已降级的 jsx() 调用被原样包进 render
    expect(out).toMatch(/return \(\) => .*jsx\(/)
  })
})

describe('@actview/compiler：L1 + 宿主 automatic runtime（整链路）', () => {
  it('降级后无 JSX，且可执行得到带标记的组件 + VNode', async () => {
    const compiled = wrap(`function App() { return <div id="root">hello</div> }`)
    const js = await lowerJsx(compiled)
    expect(hasJsx(js)).toBe(false)
    expect(js).toContain('jsx')

    const body = js.replace(/^import[^\n]*\n?/gm, '')
    const App = new Function(
      'defineComponent',
      'isComponent',
      'jsx',
      'jsxs',
      'Fragment',
      `${body}\nreturn App`,
    )(defineComponent, isComponent, jsx, jsxs, Fragment)

    expect(isComponent(App)).toBe(true)
    expect(App.__actview_component).toBe(true)
    const render = App({}, { injects: {} })
    expect(typeof render).toBe('function')
    const vnode = render()
    expect(isVNode(vnode)).toBe(true)
    expect(vnode.type).toBe('div')
    expect(vnode.props.id).toBe('root')
    expect(vnode.props.children).toBe('hello')
  })

  it('Fragment / 早退分支执行正确（条件在 setup 期一次求值）', async () => {
    const compiled = wrap(`
      function App(props) {
        if (!props.ok) return <span>no</span>
        return (
          <>
            <b>yes</b>
          </>
        )
      }
    `)
    const js = await lowerJsx(compiled)
    const body = js.replace(/^import[^\n]*\n?/gm, '')
    const App = new Function(
      'defineComponent',
      'isComponent',
      'jsx',
      'jsxs',
      'Fragment',
      `${body}\nreturn App`,
    )(defineComponent, isComponent, jsx, jsxs, Fragment)

    expect(isComponent(App)).toBe(true)
    expect(App({ ok: true }, { injects: {} })().type).toBe(Fragment)
    expect(App({ ok: false }, { injects: {} })().type).toBe('span')
  })
})

describe('@actview/compiler：与 L2 解耦的边界', () => {
  it('L1 不注入 jsx runtime import（那是宿主/JSX 工具链的事）', () => {
    const out = transformSync(COUNTER, {
      plugins: [wrapComponentsPlugin],
      parserOpts,
      configFile: false,
      babelrc: false,
    })?.code ?? ''
    expect(out).toContain('from "@actview/runtime-core"')
    expect(out).not.toContain('jsx-runtime')
  })
})

