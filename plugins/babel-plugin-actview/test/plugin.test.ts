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
    expect(out).toContain('return () => _jsx("div"')
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
    expect(out).toContain('return _jsx("div"')
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
    expect(out).toContain('return () => _jsx("span"')
  })

  it('废弃方案文档化：箭头函数 block body + setup 风格也不转换', () => {
    const out = transform(
      `const E = () => { const x = 1; return function() { return <i>{x}</i> } }`,
    )
    expect(out).toContain('const E = () => {')
    expect(out).toContain('return function () {')
    expect(out).toContain('return _jsx("i"')
    expect(out).not.toContain('defineComponent')
  })

  it('早退 return JSX / null 包成 render 函数', () => {
    const out = transform(
      `function F(props) { if (props.show) return <div>y</div>; return null }`,
    )
    expect(out).toContain('return () => _jsx("div"')
    expect(out).toContain('return () => null')
  })

  it('default 导出箭头组件：export default () => <JSX/>', () => {
    const out = transform(`export default () => <div>def</div>`)
    expect(out).toContain('export default defineComponent(() => {')
    expect(out).toContain('return () => _jsx("div"')
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
    expect(out).toContain('const small = () => _jsx("div"')
    expect(out).toContain('function data()')
  })

  it('嵌套子组件：父组件体内的子组件函数也被转换，父的早退遍历不误包子 return', () => {
    const out = transform(
      `function App() { function Child() { return <span/> } return <Child/> }`,
    )
    expect(out).toContain('const App = defineComponent')
    expect(out).toContain('const Child = defineComponent')
    // Child 的 return 仍被 Child 自己转换，App 的 return <Child/> 包成 render
    expect(out).toContain('return () => _jsx(Child')
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
    expect(out).toContain('return () => _jsx("div"')
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
    expect(out).toContain('return () => props.condition ? _jsx(Comp')
  })

  it('结尾三元双 JSX 分支 `? <A/> : <B/>`', () => {
    const out = transform(
      `function P(props) { return props.ok ? <A /> : <B /> }`,
    )
    expect(out).toContain('return () => props.ok ? _jsx(A')
  })

  it('逻辑与 `return cond && <Comp/>`', () => {
    const out = transform(
      `function Child(props) { return props.condition && <Comp /> }`,
    )
    expect(out).toContain('return () => props.condition && _jsx(Comp')
  })

  it('早退三元：if 内 return cond ? <A/> : <B/>', () => {
    const out = transform(
      `function F(p) { if (p.a) return p.b ? <A/> : <B/>; return null }`,
    )
    expect(out).toContain('return () => p.b ? _jsx(A')
    expect(out).toContain('return () => null')
  })

  it('嵌套三元', () => {
    const out = transform(
      `function G(p) { return p.a ? (p.b ? <A/> : <B/>) : null }`,
    )
    expect(out).toContain('return () => p.a ? p.b ? _jsx(A')
  })

  it('箭头 expression body 三元', () => {
    const out = transform(`const C = (p) => (p.a ? <A/> : null)`)
    expect(out).toContain('const C = defineComponent(p => {')
    expect(out).toContain('return () => p.a ? _jsx(A')
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

describe('defineComponentPlugin：组件统一函数形态（方案 3，无 props 白名单）', () => {
  it('内联对象类型 → 统一 defineComponent(function)（不再提取白名单）', () => {
    const out = transform(
      `function Child(props: { x1: string, x2?: number }) { return <div>{props.x1}</div> }`,
    )
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
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

  it('解构参数（无类型注解）：{ x1, x2 } → 统一函数形态', () => {
    const out = transform(
      `function App({ x1, x2 }) { return <div>{x1}{x2}</div> }`,
    )
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
  })

  it('解构 + 类型注解：{ x1 }: { x1: string } → 统一函数形态', () => {
    const out = transform(
      `function App({ x1 }: { x1: string }) { return <div>{x1}</div> }`,
    )
    expect(out).toContain('defineComponent(function')
    expect(out).not.toContain('props: [')
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

describe('defineComponentPlugin：<solid> 序列化标记', () => {
  it('solid 序列化标记', () => {
    const out = transform(
      `function App() {
        const rows = reactive([])
        return (
          <div>
            <solid>
              {rows.map(row => <tr key={row.id}>{row.label}</tr>)}
            </solid>
          </div>
        )
      }`,
    )
    // 序列化为 _jsx('solid', {children: [字符串]})，不含 createSolidVNode（编译留给独立插件）
    expect(out).toContain('_jsx("solid"')
    expect(out).toContain('rows.map(row => <tr key={row.id}>{row.label}</tr>)')
    expect(out).not.toContain('createSolidVNode')
    expect(out).not.toContain('createEffect')
  })

  it('无 <solid> 不产生 solid 标记', () => {
    const out = transform(`function A() { return <div>x</div> }`)
    expect(out).not.toContain('_jsx("solid"')
  })
})
