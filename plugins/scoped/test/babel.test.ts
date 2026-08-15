// ============================================================
// babel.test.ts — scopedBabelPlugin 单元测试（?scoped import 触发）
// 覆盖两种输入形态（源码 JSX / 已降级 _jsx 调用）与文件级注入语义
// ============================================================

import { describe, it, expect } from 'vitest'
import * as babel from '@babel/core'
import { scopedBabelPlugin } from '../src/babel.ts'
import { getHash } from '../src/css.ts'

/** 测试用路径解析：/proj/<去 ./ 的 import 源（剥 query）> */
const resolveCssPath = (src: string) =>
  '/proj/' + src.split('?')[0].replace(/^\.\//, '')
const pluginItem = babel.createConfigItemSync(
  scopedBabelPlugin({ resolveCssPath }),
  { type: 'plugin' },
)

function run(code: string, name = 'src/App.tsx') {
  const result = babel.transformSync(code, {
    filename: name,
    plugins: [pluginItem],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    retainLines: true,
    babelrc: false,
    configFile: false,
  })
  return result?.code ?? ''
}

const hash = (src: string) => getHash(resolveCssPath(src))

describe('源码 JSX 形态注入', () => {
  it('?scoped import 触发：文件内所有 JSX 元素注入 data-v-hash（含嵌套/条件渲染）', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  const item = (x) => <li key={x}>{x}</li>
  return <div className="x"><span>hi</span>{items.map(i => item(i))}</div>
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`<div className="x" ${attr}="">`)
    expect(out).toContain(`<span ${attr}="">hi</span>`)
    expect(out).toContain(`<li key={x} ${attr}="">`)
  })

  it('文件级：同一文件多个组件全部注入（无组件级区分）', () => {
    const out = run(`
import './App.css?scoped'
function A() {
  return <div id="a" />
}
function B() {
  return <div id="b" />
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`<div id="a" ${attr}=""`)
    expect(out).toContain(`<div id="b" ${attr}=""`)
  })

  it('组件元素与原生元素一致注入 data-v-hash（组件边界转换在运行时完成）', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return <Card title="t"><div class="inner">x</div></Card>
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`<Card title="t" ${attr}="">`)
    expect(out).toContain(`<div class="inner" ${attr}="">x</div>`)
    expect(out).not.toContain('scopedId')
  })

  it('插槽内容元素额外注入 data-v-hash-s（:slotted 语义）', () => {
    const out = run(`
import './Card.css?scoped'
function App() {
  return <Card><template slot="header"><b>title</b></template></Card>
}
`)
    const attr = `data-v-${hash('./Card.css?scoped')}`
    expect(out).toContain(`<b ${attr}="" ${attr}-s="">title</b>`)
  })
})

describe('_jsx 降级形态注入（esbuild 先于 Babel 执行）', () => {
  it('_jsx() 调用 props 对象注入属性，嵌套调用同样处理', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return () => _jsx('div', { className: 'x', children: _jsx('span', { children: 'hi' }) })
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`"${attr}": ""`)
    expect(out).toContain(`children: 'hi', "${attr}": ""`)
  })

  it('jsxs / jsxDEV 等自动运行时工厂同样注入', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return _jsxs('div', { children: [_jsxDEV('span', {})] })
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    const count = out.split(`"${attr}": ""`).length - 1
    expect(count).toBe(2)
  })

  it('_jsx() 无 props（_jsx("div", null)）时创建空对象注入', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return _jsx('div', null)
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`_jsx('div', { "${attr}": "" })`)
  })

  it('_jsx 形态的组件（非字符串 type）同样注入 data-v 属性（转换在运行时）', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return _jsx(Card, { title: 't' })
}
`)
    const attr = `data-v-${hash('./App.css?scoped')}`
    expect(out).toContain(`_jsx(Card, { title: 't', "${attr}": "" })`)
    expect(out).not.toContain('scopedId')
  })

  it('_jsx 形态的插槽内容同样注入 -s 属性（:slotted 在 esbuild 先转管线可用）', () => {
    const out = run(`
import './Card.css?scoped'
function App() {
  return _jsx('Card', { children: _jsx('template', { slot: 'header', children: _jsx('b', { children: 'title' }) }) })
}
`)
    const attr = `data-v-${hash('./Card.css?scoped')}`
    // 插槽内容 <b> 同时注入 attr 与 slotAttr
    expect(out).toContain(`children: 'title', "${attr}": "", "${attr}-s": ""`)
  })
})

describe('多 ?scoped import', () => {
  it('多个 css 文件注入多个 hash', () => {
    const out = run(`
import './a.css?scoped'
import './b.css?scoped'
function App() {
  return <div class="x" />
}
`)
    const a = `data-v-${hash('./a.css?scoped')}`
    const b = `data-v-${hash('./b.css?scoped')}`
    expect(out).toContain(`<div class="x" ${a}="" ${b}=""`)
  })

  it('同一 css 重复 import 不重复注入（去重）', () => {
    const out = run(`
import './a.css?scoped'
import './a.css?scoped'
function App() {
  return <div />
}
`)
    const a = `data-v-${hash('./a.css?scoped')}`
    const count = out.split(` ${a}=""`).length - 1
    expect(count).toBe(1)
  })
})

describe('触发条件与边界', () => {
  it('无 ?scoped import：完全不处理，原样输出', () => {
    const code = `
import './plain.css'
function App() {
  return <div>plain</div>
}
`
    const out = run(code)
    expect(out).toContain(`import './plain.css'`)
    expect(out).toContain('<div>plain</div>')
    expect(out).not.toContain('data-v-')
  })

  it('?scoped 带附加参数（?scoped&lang=less）同样识别', () => {
    const out = run(`
import './d.css?scoped&lang=less'
function App() { return <div>d</div> }
`)
    expect(out).toContain(`data-v-${hash('./d.css?scoped&lang=less')}`)
  })

  it('有 ?scoped import 但无 JSX：不注入任何属性', () => {
    const out = run(`
import './logic.css?scoped'
const helper = () => 42
`)
    expect(out).not.toContain('data-v-')
  })

  it('import 语句原样保留（不再改写 source）', () => {
    const out = run(`
import './App.css?scoped'
function App() {
  return <div />
}
`)
    expect(out).toContain(`import './App.css?scoped'`)
  })
})
