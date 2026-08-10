# Babel 自动转换规则（defineComponent）

> `@actview/babel-plugin-actview` 的 `defineComponentPlugin`（Babel 插件）在编译期把 **ActView 组件**自动包装为 `defineComponent`——tsx 源码**不需要手写** `defineComponent`，写裸函数即可。
>
> 运行时只认 `defineComponent` 产物（含 `__setup` 的对象）；未包装的函数被当 vnode.type 时会触发 `InvalidCharacterError: The tag name provided ('function X(...) {...}') is not a valid name`。

## 组件契约（`__setup` 的两种合法返回形态）

```tsx
// 形态 1：直接 return JSX（简写组件）——插件自动包成 render 函数
function A() {
  return <div>hi</div>
}
// 编译后：

const A = defineComponent(function () { return () => <div>hi</div> })

> ⚠️ **设计约束（2026-08）**：只支持简写组件（最后 `return JSX` / `_jsx()` / `null` /
> 三元逻辑渲染表达式）。
> `return function(){...}`（setup 风格 / 渲染函数）**不允许**——组件嵌套方案已废弃（bug 多），
> 此类组件保持裸函数不被转换（运行时若被当组件会报 `InvalidCharacterError`，属非法写法）。
>
> 组件写法唯一形态：
> ```tsx
> function X(props) { setup...; return <JSX/> }   // setup 阶段逻辑 + 最后 return JSX
> // =》 const X = defineComponent(function (props) { setup...; return () => <JSX/> })
> ```

```tsx
// 形态 2：options 形态（自动 props 白名单）——第一个参数带 TS 类型注解 / 解构
function B(props: { title: string, count?: number }) {
  return <div>{props.title}</div>
}
// 编译后（props 声明内进 setup.props、声明外进 ctx.attrs）：

const B = defineComponent({
  props: ["title", "count"],
  setup: function (props) { return () => <div>{props.title}</div> },
})
```

## 会被自动转换的代码（所有场景）

### 1. function 声明（简写：最后 return JSX）

```tsx
function A() { return <div>hi</div> }
```
```js
const A = defineComponent(function () { return () => <div>hi</div> })
```

### 2. ⚠️ 已废弃 —— setup 风格（最后 return 渲染函数）不被转换

```tsx
// 不允许（组件嵌套方案已废弃）：
function B(props) {
  const n = useSomething()
  return function () { return <div>{n}</div> }
}
```
```js
// 编译后：保持裸函数（不包装、不注入 defineComponent）
function B(props) {
  const n = useSomething()
  return function () { return <div>{n}</div> }
}
```
正确写法：把渲染逻辑直接 `return JSX`（简写组件）。

### 3. function 声明（return null 结尾）

```tsx
function C() { if (x) return <div/>; return null }
```
```js
const C = defineComponent(function () { if (x) return () => <div/>; return () => null })
```

### 4. 函数表达式（const X = function）

```tsx
const D = function (props) { return <p>{props.a}</p> }
```
```js
const D = defineComponent(function (props) { return () => <p>{props.a}</p> })
```

### 5. 箭头函数（expression body：() => JSX）

```tsx
const E = () => <span>e</span>
```
```js
const E = defineComponent(() => { return () => <span>e</span> })
```

### 6. ⚠️ 已废弃 —— 箭头函数 block body + setup 风格不被转换

```tsx
// 不允许：
const F = () => { const n = 1; return function () { return <i>{n}</i> } }
```
```js
// 编译后：保持原样（不包装）
const F = () => { const n = 1; return function () { return <i>{n}</i> } }
```

### 7. export default 箭头 / 函数组件

```tsx
export default () => <div>def</div>
```
```js
export default defineComponent(() => { return () => <div>def</div> })
```

### 8. export default 匿名函数

```tsx
export default function () { return <div>anon</div> }
```
```js
export default defineComponent(function () { return () => <div>anon</div> })
```

### 9. 早退 return JSX / null（函数体任意位置）

```tsx
function F(props) { if (props.show) return <div>y</div>; return null }
```
```js
const F = defineComponent(function (props) {
  if (props.show) return () => <div>y</div>
  return () => null
})
```

### 10. 结尾 / 早退 return 三元 / 逻辑表达式（条件渲染）

```tsx
function Child(props) { return props.condition ? <Comp /> : null }
// 双 JSX 分支 / 嵌套三元 / 逻辑与 / 箭头 expression body / if 内早退三元均可：
function P(props) { return props.ok ? <A /> : <B /> }
function G(p) { return p.a ? (p.b ? <A/> : <B/>) : null }
function C2(p) { return p.condition && <Comp /> }
const C3 = (p) => (p.a ? <A/> : null)
```
```js
const Child = defineComponent(function (props) { return () => props.condition ? <Comp /> : null })
```

> 判定：三元/逻辑表达式的任一分支含 JSX / `_jsx()` 调用即触发（null 分支**不单独触发**）。
> 非渲染三元保持裸函数：`p.a ? 1 : 2`、`p.v ?? null`、`a && null`、`p.ok ? null : p.name`。

### 11. JSX 已降级为 `_jsx()` 调用（rolldown/esbuild 先转换）

```tsx
const E2 = function (p) { return _jsx('div', { children: p.x }) }
```
```js
const E2 = defineComponent(function (p) { return () => _jsx('div', { children: p.x }) })
```

### 12. 嵌套子组件（父组件体内的子组件函数也被转换）

```tsx
function App() { function Child() { return <span/> } return <Child/> }
```
```js
const App = defineComponent(function () { ... return () => <Child/> })
const Child = defineComponent(function () { return () => <span/> })
```

### 13. 具名插槽 / 作用域插槽（编译期提取为 slots prop）

```tsx
// 仅首字母大写的组件接受；template 从 children 移除
const Card = () => <Panel><template slot="h">H</template><i>body</i></Panel>
// 作用域插槽：template 上除 slot 外的无值属性名声明为插槽函数参数
const List = () => <ListWrap><template slot="item" item><b>{item}</b></template></ListWrap>
```
```js
const Card = defineComponent(() => { return () => <Panel slots={{ h: () => <>H</> }}><i>body</i></Panel> })
const List = defineComponent(() => { return () => <ListWrap slots={{ item: item => <><b>{item}</b></> }} /> })
```

> 插槽提取递归生效（walkJSX / walkExpression）：JSX 树内的元素/Fragment/表达式容器、
> `&&`/三元/箭头函数/数组/对象/调用参数中嵌套的 JSX 均会提取；仅字符串字面量
> `slot="name"` 触发。

### 14. 自动 props 白名单（TS 类型注解 / 解构参数）

```tsx
// A. 第一个参数的内联 TS 对象类型字面量（成员名即白名单，可选 `?` 同样提取）
function Child(props: { x1: string, x2?: number }) { return <div>{props.x1}</div> }
// B. 解构参数（无类型注解，属性名即白名单）
function App({ x1, x2 }) { return <div>{x1}{x2}</div> }
// C. 解构 + 类型注解
function App2({ x1 }: { x1: string }) { return <div>{x1}</div> }
```
```js
const Child = defineComponent({ props: ["x1", "x2"], setup: function (props) { return () => <div>{props.x1}</div> } })
```

> 提取成功 → options 形态（`defineComponent({ props, setup })`）：声明内进 `setup.props`、
> 声明外进 `ctx.attrs`（对齐 Vue props 白名单分离）。**回退函数形态**（props 全量）的场景：
> - 无类型注解且非解构 / `props: any` / 类型别名引用（如 `MyProps`，Babel 无类型检查器无法跨文件解析）
> - 解构带 rest（`{ x1, ...rest }`）：白名单会截断 rest，保守回退保持 rest 语义
> - esbuild/rolldown 先转后类型与解构已剥离（拿到的是降级 JS）→ 自动回退（best-effort）
> - 无参数组件

## 不会被转换的代码

| 场景 | 示例 | 原因 |
|---|---|---|
| 小写命名 | `const small = () => <div/>` | 首字母非大写，视为普通函数 |
| 非 JSX 返回 | `function helper() { return 1 }` / `function data() { return {a:1} }` | 最后 return 不是 JSX / `_jsx` 调用 / 渲染函数 / null / 渲染表达式 |
| 手动 defineComponent | `const G = defineComponent(function(){...})` | init 是 call 表达式，不重复包装 |
| return 变量引用 | `function H() { return Comp }` | return 的是标识符（非字面量 JSX/函数），无法静态判定 |
| 非函数声明 | `const obj = {...}` / `class X {}` | init 不是函数 |
| 纯数值三元 | `function H(p) { return p.a ? 1 : 2 }` | 分支无渲染内容 |
| 空值合并 / 裸 null 分支 | `p.v ?? null` / `a && null` / `p.ok ? null : p.name` | null 分支不单独触发渲染判定 |
| 解构带 rest | `function App({ x1, ...rest }) {...}` | 白名单会截断 rest 语义，保守回退 |

## 判定逻辑（wrapComponentFn 摘要）

```
最后一条语句的返回值 ret：
  ret 是 JSX 元素 / Fragment                 → 组件，return 包成 () => ret
  ret 是 _jsx/_jsxs/jsx 调用                 → 组件，return 包成 () => ret
  ret 是 null                                → 组件，return 包成 () => null
  ret 是三元/逻辑表达式（任一分支含 JSX/_jsx）→ 组件，return 包成 () => ret
  ret 是函数（渲染函数，setup 风格）          → ❌ 不允许（嵌套方案已废弃），不转换
  其他                                       → 非组件，跳过
函数体任意位置的早退 return（JSX / _jsx / null / 渲染表达式）同样包成 render 函数
  （wrapEarlyReturns：仅处理函数体自身的 return，排除嵌套函数——子组件由各自 visitor 转换）

包装后自动提取 props 白名单（extractPropsFromType）：
  第一个参数内联 TS 对象类型 / 解构参数（无 rest）→ options 形态 defineComponent({ props, setup })
  其余情况                                       → 函数形态 defineComponent(setup)
文件末尾：有转换发生且无 defineComponent 导入时，自动注入 import { defineComponent } from '@actview/core'
```

## 验证

- 插件转换测试：`plugins/babel-plugin-actview/test/plugin.test.ts`（30 用例，`npx vitest run plugins/babel-plugin-actview/test/plugin.test.ts`）
- 全量回归：`pnpm test`（含 verify 场景 1-31 等全部用例）
