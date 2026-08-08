# Babel 自动转换规则（defineComponent）

> `@actview/plugin` 的 `defineComponentPlugin`（Babel 插件）在编译期把 **ActView 组件**自动包装为 `defineComponent`——tsx 源码**不需要手写** `defineComponent`，写裸函数即可。
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

> ⚠️ **设计约束（2026-08）**：只支持简写组件（最后 `return JSX` / `_jsx()` / `null`）。
> `return function(){...}`（setup 风格 / 渲染函数）**不允许**——组件嵌套方案已废弃（bug 多），
> 此类组件保持裸函数不被转换（运行时若被当组件会报 `InvalidCharacterError`，属非法写法）。
>
> 组件写法唯一形态：
> ```tsx
> function X(props) { setup...; return <JSX/> }   // setup 阶段逻辑 + 最后 return JSX
> // =》 const X = defineComponent(function (props) { setup...; return () => <JSX/> })
> ```
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

### 10. JSX 已降级为 `_jsx()` 调用（rolldown/esbuild 先转换）

```tsx
const E2 = function (p) { return _jsx('div', { children: p.x }) }
```
```js
const E2 = defineComponent(function (p) { return () => _jsx('div', { children: p.x }) })
```

### 11. 嵌套子组件（父组件体内的子组件函数也被转换）

```tsx
function App() { function Child() { return <span/> } return <Child/> }
```
```js
const App = defineComponent(function () { ... return () => <Child/> })
const Child = defineComponent(function () { return () => <span/> })
```

### 12. 具名插槽（编译期提取为 slots prop）

```tsx
const Card = () => <Panel><template slot="h">H</template><i>body</i></Panel>
```
```js
const Card = defineComponent(() => { return () => <Panel slots={{ h: () => <>H</> }}><i>body</i></Panel> })
```

## 不会被转换的代码

| 场景 | 示例 | 原因 |
|---|---|---|
| 小写命名 | `const small = () => <div/>` | 首字母非大写，视为普通函数 |
| 非 JSX 返回 | `function helper() { return 1 }` / `function data() { return {a:1} }` | 最后 return 不是 JSX / `_jsx` 调用 / 渲染函数 / null |
| 手动 defineComponent | `const G = defineComponent(function(){...})` | init 是 call 表达式，不重复包装 |
| return 变量引用 | `function H() { return Comp }` | return 的是标识符（非字面量 JSX/函数），无法静态判定 |
| 非函数声明 | `const obj = {...}` / `class X {}` | init 不是函数 |

## 判定逻辑（wrapComponentFn 摘要）

```
最后一条语句的返回值 ret：
  ret 是 JSX 元素 / Fragment        → 组件，return 包成 () => ret
  ret 是 _jsx/_jsxs/jsx 调用        → 组件，return 包成 () => ret
  ret 是 null                       → 组件，return 包成 () => null
  ret 是函数（渲染函数，setup 风格） → ❌ 不允许（嵌套方案已废弃），不转换
  其他                              → 非组件，跳过
```

## 验证

- 插件转换测试：`plugins/plugin/test/plugin.test.ts`（12 用例，`npx vitest run plugins/plugin/test/plugin.test.ts`）
- 全量回归：`pnpm test`（含 verify 场景 1-29）
