// ============================================================
// defineComponentPlugin 转换测试（Babel transform 输出断言）
// 覆盖：简写裸函数 / setup 风格 / 函数表达式 / 箭头函数 /
//       expression body / 早退 return / default 导出 / 不误转非组件
// 运行：npx vitest run plugins/babel-plugin-actview/test/plugin.test.ts
// ============================================================

import { describe, it, expect } from 'vitest'
import { transformSync } from '@babel/core'
import defineComponentPlugin from '../src/babel-plugin'

function transform(code: string): string {
  const result = transformSync(code, {
    plugins: [[defineComponentPlugin]] as any,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    configFile: false,
    babelrc: false,
  })
  return result?.code ?? ''
}

describe('defineComponentPlugin：Babel 自动转换组件', () => {
  it('简写裸函数：function X() { return <JSX/> } → defineComponent', () => {
    const out = transform(`function A() { return <div>hi</div> }`)
    expect(out).toContain('const A = defineComponent(function () {')
    expect(out).toContain('return () => <div>hi</div>')
    expect(out).toMatch(/import \{ defineComponent \} from "@actview\/core"/)
  })

  it('废弃方案文档化：setup 风格（return 渲染函数）不被转换——保持裸函数', () => {
    // 组件嵌套方案已废弃（bug 多）：只允许简写组件（return JSX）。
    // return function(){...} 的组件保持原样（插件不包装，不注入 import）。
    const out = transform(
      `function B(props) { const n = 1; return function() { return <div>{n}</div> } }`,
    )
    expect(out).toContain('function B(props)')
    expect(out).toContain('return function () {')
    expect(out).toContain('return <div>{n}</div>')
    // 未转换：无 defineComponent
    expect(out).not.toContain('defineComponent')
  })

  it('缺陷 2：函数表达式组件 const X = function(props) {...} → defineComponent', () => {
    const out = transform(`const C = function (props) { return <p>{props.a}</p> }`)
    expect(out).toContain('const C = defineComponent(function (props) {')
    expect(out).toContain('return () => <p>{props.a}</p>')
  })

  it('缺陷 2：箭头函数 expression body：const X = () => <JSX/> → defineComponent', () => {
    const out = transform(`const D = () => <span>d</span>`)
    expect(out).toContain('const D = defineComponent(() => {')
    expect(out).toContain('return () => <span>d</span>')
  })

  it('废弃方案文档化：箭头函数 block body + setup 风格也不转换', () => {
    const out = transform(
      `const E = () => { const x = 1; return function() { return <i>{x}</i> } }`,
    )
    expect(out).toContain('const E = () => {')
    expect(out).toContain('return function () {')
    expect(out).toContain('return <i>{x}</i>')
    expect(out).not.toContain('defineComponent')
  })

  it('早退 return JSX / null 包成 render 函数', () => {
    const out = transform(
      `function F(props) { if (props.show) return <div>y</div>; return null }`,
    )
    expect(out).toContain('return () => <div>y</div>')
    expect(out).toContain('return () => null')
  })

  it('default 导出箭头组件：export default () => <JSX/>', () => {
    const out = transform(`export default () => <div>def</div>`)
    expect(out).toContain('export default defineComponent(() => {')
    expect(out).toContain('return () => <div>def</div>')
  })

  it('不误转：小写函数、非 JSX 返回、手动 defineComponent、非函数 init', () => {
    const code = [
      `function helper() { return 1 }`,
      `const small = () => <div/>`,
      `function data() { return { a: 1 } }`,
      `const G = defineComponent(function () { return <div/> })`,
      `const obj = { fn: function () { return 1 } }`,
    ].join('\n')
    const out = transform(code)
    // 没有新的 defineComponent 包裹
    const defs = out.match(/const \w+ = defineComponent/g) ?? []
    expect(defs.length).toBe(1) // 仅手动 G 一个定义（import 不计）
    expect(out).toContain('function helper()')
    expect(out).toMatch(/const small = \(\) => <div \/>/)
    expect(out).toContain('function data()')
  })

  it('嵌套子组件：父组件体内的子组件函数也被转换，父的早退遍历不误包子 return', () => {
    const out = transform(
      `function App() { function Child() { return <span/> } return <Child/> }`,
    )
    expect(out).toContain('const App = defineComponent')
    expect(out).toContain('const Child = defineComponent')
    // Child 的 return 仍被 Child 自己转换，App 的 return <Child/> 包成 render
    expect(out).toMatch(/return \(\) => <Child \/>/)
  })

  it('具名插槽在箭头 expression body 组件中也提取', () => {
    const out = transform(
      `const Card = () => <Panel><template slot="h">H</template><i>body</i></Panel>`,
    )
    expect(out).toContain('const Card = defineComponent')
    // slots prop 被注入到 Panel（Babel 输出 key 带引号）
    expect(out).toContain('"h": () =>')
    // template 从 children 移除
    expect(out).not.toContain('template slot')
  })
})

describe('defineComponentPlugin：补充场景', () => {
  it('export default function() {...}（匿名函数声明）也转换', () => {
    const out = transform(`export default function () { return <div>anon</div> }`)
    expect(out).toContain('export default defineComponent(function () {')
    expect(out).toContain('return () => <div>anon</div>')
  })

  it('isJsxCall（JSX 已降级为 _jsx 调用）仍转换', () => {
    // 模拟 rolldown/esbuild 已把 JSX 转成 _jsx() 调用的输入
    const out = transform(
      `const E = function (p) { return _jsx('div', { children: p.x }) }`,
    )
    expect(out).toContain('const E = defineComponent')
    expect(out).toContain('return () => _jsx')
  })
})
