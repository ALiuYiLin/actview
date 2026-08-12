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
    expect(out).toContain('return () => _hoisted1') // 全静态子树提升为常量
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
    expect(out).toContain('_jsx("div"') // JSX 已编译为 _jsx 调用
    // 未转换：无 defineComponent
    expect(out).not.toContain('defineComponent')
  })

  it('缺陷 2：函数表达式组件 const X = function(props) {...} → defineComponent', () => {
    const out = transform(`const C = function (props) { return <p>{props.a}</p> }`)
    expect(out).toContain('const C = defineComponent(function (props) {')
    expect(out).toContain('return () => _jsx("p"')
  })

  it('缺陷 2：箭头函数 expression body：const X = () => <JSX/> → defineComponent', () => {
    const out = transform(`const D = () => <span>d</span>`)
    expect(out).toContain('const D = defineComponent(() => {')
    expect(out).toContain('return () => _hoisted1')
  })

  it('废弃方案文档化：箭头函数 block body + setup 风格也不转换', () => {
    const out = transform(
      `const E = () => { const x = 1; return function() { return <i>{x}</i> } }`,
    )
    expect(out).toContain('const E = () => {')
    expect(out).toContain('return function () {')
    expect(out).toContain('_jsx("i"')
    expect(out).not.toContain('defineComponent')
  })

  it('早退 return JSX / null 包成 render 函数', () => {
    const out = transform(
      `function F(props) { if (props.show) return <div>y</div>; return null }`,
    )
    expect(out).toContain('return () => _hoisted1')
    expect(out).toContain('return () => null')
  })

  it('default 导出箭头组件：export default () => <JSX/>', () => {
    const out = transform(`export default () => <div>def</div>`)
    expect(out).toContain('export default defineComponent(() => {')
    expect(out).toContain('return () => _hoisted1')
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
    expect(out).toMatch(/const small = \(\) => _hoisted\d+/)
    expect(out).toContain('function data()')
  })

  it('嵌套子组件：父组件体内的子组件函数也被转换，父的早退遍历不误包子 return', () => {
    const out = transform(
      `function App() { function Child() { return <span/> } return <Child/> }`,
    )
    expect(out).toContain('const App = defineComponent')
    expect(out).toContain('const Child = defineComponent')
    // Child 的 return 仍被 Child 自己转换，App 的 return <Child/> 包成 render
    expect(out).toMatch(/return \(\) => _jsx\(Child/)
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
    expect(out).toContain('return () => _hoisted1')
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

describe('defineComponentPlugin：三元 / 逻辑 return 条件渲染', () => {
  it('结尾三元 `? <Comp/> : null` 包成 render 函数', () => {
    const out = transform(
      `function Child(props) { return props.condition ? <Comp /> : null }`,
    )
    expect(out).toContain('const Child = defineComponent(function (props) {')
    expect(out).toContain('props.condition ? _jsx(Comp')
  })

  it('结尾三元双 JSX 分支 `? <A/> : <B/>`', () => {
    const out = transform(
      `function P(props) { return props.ok ? <A /> : <B /> }`,
    )
    expect(out).toContain('props.ok ? _jsx(A')
  })

  it('逻辑与 `return cond && <Comp/>`', () => {
    const out = transform(
      `function Child(props) { return props.condition && <Comp /> }`,
    )
    expect(out).toContain('props.condition && _jsx(Comp')
  })

  it('早退三元：if 内 return cond ? <A/> : <B/>', () => {
    const out = transform(
      `function F(p) { if (p.a) return p.b ? <A/> : <B/>; return null }`,
    )
    expect(out).toContain('p.b ? _jsx(A')
    expect(out).toContain('return () => null')
  })

  it('嵌套三元', () => {
    const out = transform(
      `function G(p) { return p.a ? (p.b ? <A/> : <B/>) : null }`,
    )
    expect(out).toContain('p.a ? p.b ? _jsx(A')
  })

  it('箭头 expression body 三元', () => {
    const out = transform(`const C = (p) => (p.a ? <A/> : null)`)
    expect(out).toContain('const C = defineComponent(p => {')
    expect(out).toContain('p.a ? _jsx(A')
  })

  it('纯数值三元不转换（保持裸函数）', () => {
    const out = transform(`function H(p) { return p.a ? 1 : 2 }`)
    expect(out).not.toContain('defineComponent')
    expect(out).toContain('return p.a ? 1 : 2')
  })

  it('空值合并 `p.v ?? null` 不转换（null 分支不触发）', () => {
    const out = transform(`function H(p) { return p.v ?? null }`)
    expect(out).not.toContain('defineComponent')
    expect(out).toContain('return p.v ?? null')
  })

  it('`a && null` 不转换（逻辑表达式内 null 不参与）', () => {
    const out = transform(`function H(p) { return p.a && null }`)
    expect(out).not.toContain('defineComponent')
    expect(out).toContain('return p.a && null')
  })

  it('`p.ok ? null : p.name` 不转换（null 分支配非渲染分支）', () => {
    const out = transform(`function H(p) { return p.ok ? null : p.name }`)
    expect(out).not.toContain('defineComponent')
    expect(out).toContain('return p.ok ? null : p.name')
  })
})

describe('defineComponentPlugin：自动 props 提取（TS 类型注解）', () => {
  it('内联对象类型 → defineComponent({ props, setup })', () => {
    const out = transform(
      `function Child(props: { x1: string, x2?: number }) { return <div>{props.x1}</div> }`,
    )
    expect(out).toContain('props: ["x1", "x2"]')
    expect(out).toContain('setup: function')
  })

  it('props: any → 函数形态回退（无白名单）', () => {
    const out = transform(`function P(props: any) { return <div>{props.x}</div> }`)
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
  })

  it('类型别名引用（MyProps）→ 函数形态回退（Babel 无法静态解析）', () => {
    const out = transform(`function R(props: MyProps) { return <div>r</div> }`)
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
  })

  it('无参数组件 → 函数形态', () => {
    const out = transform(`function Q() { return <div>q</div> }`)
    expect(out).toContain('defineComponent(function')
  })

  it('esbuild 先转（类型已剥离）：props 无注解 → 函数形态回退', () => {
    // 模拟 rolldown 先转后的 JS（类型注解已剥离）
    const out = transform(
      `function C(props) { return _jsx('div', { children: props.x }) }`,
    )
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
  })

  it('解构参数（无类型注解）：{ x1, x2 } → props 白名单', () => {
    const out = transform(
      `function App({ x1, x2 }) { return <div>{x1}{x2}</div> }`,
    )
    expect(out).toContain('props: ["x1", "x2"]')
    expect(out).toContain('setup: function')
  })

  it('解构 + 类型注解：{ x1 }: { x1: string } → props 白名单', () => {
    const out = transform(
      `function App({ x1 }: { x1: string }) { return <div>{x1}</div> }`,
    )
    expect(out).toContain('props: ["x1"]')
  })

  it('解构带 rest（{ x1, ...rest }）：保守回退函数形态', () => {
    // rest 需要运行时全量 props（白名单会截断 rest），回退保持 rest 语义
    const out = transform(
      `function App({ x1, ...rest }) { return <div>{x1}</div> }`,
    )
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
  })
})

describe('defineComponentPlugin：v-memo 指令编译', () => {
  it('v-memo={[deps]} → 第 7 参 deps 工厂，不进 props', () => {
    const out = transform(`function Row() { return <tr v-memo={[a, b]}>x</tr> }`)
    expect(out).toContain('() => [a, b]') // deps 工厂（闭包捕获 render 变量）
    expect(out).not.toContain('"v-memo"') // 不进 props
    expect(out).not.toContain('_hoisted1') // 有 v-memo → 不整体提升（元素每次重建）
  })

  it('v-memo 元素 props 静态时 props 仍提升，但元素本身每次调用', () => {
    const out = transform(
      `function Row() { return <tr id="x" v-memo={[n]}>y</tr> }`,
    )
    // props（id）提升为 _hoistedProps1，元素每次 _jsx 调用并携带 deps 工厂
    expect(out).toContain('_hoistedProps1')
    expect(out).toContain('() => [n]')
  })

  it('v-memo 与动态 props 共存：flag 正常标记', () => {
    const out = transform(
      `function Row() { return <tr v-memo={[n]} class={c}>y</tr> }`,
    )
    expect(out).toContain('() => [n]')
    expect(out).toContain('"class"') // 动态 props key 记录
  })
})

describe('defineComponentPlugin：block tree 编译（v-memo 元素 = block）', () => {
  it('v-memo 元素 → openBlock()/setupBlock() 包装 + import', () => {
    const out = transform(`function Row() { return <tr v-memo={[a]}>x</tr> }`)
    expect(out).toContain('(openBlock(), setupBlock(_jsx(')
    expect(out).toContain('openBlock, setupBlock } from "@actview/jsx/jsx-runtime"')
    expect(out).toContain('() => [a]')
  })

  it('无 v-memo 不注入 openBlock/setupBlock', () => {
    const out = transform(`function A() { return <div>x</div> }`)
    expect(out).not.toContain('openBlock')
    expect(out).not.toContain('setupBlock')
  })
})
