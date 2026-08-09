// ============================================================
// scoped.test.tsx — scoped 功能集成测试（?scoped import 触发）
// 验证完整链路：Babel 注入 → 运行时 DOM 属性 → renderToString
// → CSS 侧 hash 与 JSX 侧 hash 一致性
// ============================================================

import { describe, it, expect } from 'vitest'
import * as babel from '@babel/core'
import { createApp, renderToString, defineComponent } from 'actview'
import {
  actviewScopedPlugin,
  scopedBabelPlugin,
  transformScopedCSS,
  getHash,
} from '@actview/plugin-scoped'

/** 测试用路径解析：/proj/src/<去 ./ 的 import 源（剥 query）> */
const resolveCssPath = (src: string) =>
  '/proj/src/' + src.split('?')[0].replace(/^\.\//, '')

/** 对源码应用 scoped Babel 转换，返回转换后代码 */
function transformSource(source: string, name = 'src/App.tsx') {
  const pluginItem = babel.createConfigItemSync(
    scopedBabelPlugin({ resolveCssPath }),
    { type: 'plugin' },
  )
  const result = babel.transformSync(source, {
    filename: name,
    plugins: [pluginItem],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    retainLines: true,
    babelrc: false,
    configFile: false,
  })
  return result?.code ?? ''
}

describe('scoped 集成：编译 → 运行时', () => {
  it('?scoped import 触发的注入经 actview 运行时渲染到真实 DOM', () => {
    const source = `
import './App.css?scoped'
function App() {
  return <div class="app"><span>hi</span></div>
}
`
    const out = transformSource(source)
    const attr = out.match(/data-v-[a-f0-9]{8}/)?.[0]
    expect(attr).toBeTruthy()

    // 构造等价于编译产物的 VNode（带注入属性）
    const App = defineComponent(function () {
      return () => (
        <div class="app" {...{ [attr as string]: '' }}>
          <span {...{ [attr as string]: '' }}>hi</span>
        </div>
      )
    })
    const host = document.createElement('div')
    host.id = 'scoped-dom-host'
    document.body.appendChild(host)
    createApp(App).mount('#scoped-dom-host')
    const root = host.firstElementChild as HTMLElement
    expect(root?.getAttribute(attr as string)).toBe('')
    expect(root?.querySelector('span')?.getAttribute(attr as string)).toBe('')
    document.body.removeChild(host)
  })

  it('renderToString 输出包含注入的 data-v 属性（SSR 兼容）', () => {
    const source = `
import './App.css?scoped'
function App() {
  return <div class="box"><p>text</p></div>
}
`
    const out = transformSource(source)
    const attr = out.match(/data-v-[a-f0-9]{8}/)?.[0]
    expect(attr).toBeTruthy()

    const App = defineComponent(function () {
      return () => (
        <div class="box" {...{ [attr as string]: '' }}>
          <p {...{ [attr as string]: '' }}>text</p>
        </div>
      )
    })
    const html = renderToString(<App />)
    expect(html).toContain(`class="box" ${attr}=""`)
    expect(html).toContain(`${attr}=""`)
  })
})

describe('scoped 集成：CSS 与 JSX 的 hash 一致性', () => {
  it('同一文件：CSS 选择器 hash 与 Babel 注入的 hash 相同', async () => {
    const source = `
import './App.css?scoped'
function App() {
  return <div class="app" />
}
`
    const out = transformSource(source)
    const jsxAttr = out.match(/data-v-[a-f0-9]{8}/)?.[0]
    const hash = getHash(resolveCssPath('./App.css?scoped'))
    expect(jsxAttr).toBe(`data-v-${hash}`)

    const cssOut = await transformScopedCSS('.app { color: red }', hash)
    expect(cssOut).toBe(`.app[data-v-${hash}] { color: red }`)
  })

  it('actviewScopedPlugin 的 css 子插件与 jsx 子插件产出同一 hash', async () => {
    const [cssP, jsxP] = actviewScopedPlugin()
    const cssId = 'E:/code3/JSX-Demo/src/App.css?scoped'
    const jsxId = 'E:/code3/JSX-Demo/src/App.tsx'

    const cssResult = await cssP.transform('.card { padding: 8px }', cssId)
    const jsxResult = await jsxP.transform(
      `
import './App.css?scoped'
function Card() {
  return <div class="card" />
}
`,
      jsxId,
    )
    const cssAttr = cssResult.code.match(/data-v-[a-f0-9]{8}/)?.[0]
    const jsxAttr = jsxResult.code.match(/data-v-[a-f0-9]{8}/)?.[0]
    expect(cssAttr).toBe(jsxAttr)
    expect(cssAttr).toBe(`data-v-${getHash('E:/code3/JSX-Demo/src/App.css')}`)
  })

  it('jsx 子插件经 Vite resolver（this.resolve）解析 alias CSS import，hash 与解析后路径一致', async () => {
    const [, jsxP] = actviewScopedPlugin()
    const jsxId = 'E:/proj/src/App.tsx'
    // mock PluginContext：alias '@/' 解析为真实绝对路径（query 保留，插件内部 cleanId 剥掉）
    const context = {
      resolve: async (src: string) =>
        src.startsWith('@/')
          ? { id: 'E:/proj/src/' + src.slice(2) }
          : { id: 'E:/proj/' + src.replace('./', '') },
    }
    const result = await jsxP.transform.call(
      context,
      `
import '@/styles/app.css?scoped'
function App() {
  return <div class="card" />
}
`,
      jsxId,
    )
    const jsxAttr = result.code.match(/data-v-[a-f0-9]{8}/)?.[0]
    // CSS 侧按 resolved id（E:/proj/src/styles/app.css，剥 query 后）计算 hash
    expect(jsxAttr).toBe(`data-v-${getHash('E:/proj/src/styles/app.css')}`)
  })
})
