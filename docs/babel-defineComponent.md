# Babel 自动转换规则（defineComponent）

> `@actview/plugin-babel` 的 `defineComponentPlugin`（Babel 插件）在编译期把 **ActView 组件**自动包装为 `defineComponent`——tsx 源码**不需要手写** `defineComponent`，写裸函数即可。
>
> 运行时只认 `defineComponent` 产物（含 `__setup` 的对象）。未转换的裸函数进入运行时：若**返回 render 函数**，PD-07 后运行时兜底按组件挂载；若返回 VNode（融合式），抛出明确报错 `必须返回 render 函数`（替代旧的 `InvalidCharacterError`）。

## 组件契约（`__setup` 的返回形态）

```tsx
// 简写组件（唯一推荐形态）——插件自动包成 render 函数
function A() {
  return <div>hi</div>
}
// 编译后（第二参数 "A" 为组件名，供 KeepAlive include/exclude / DevTools 使用）：
const A = defineComponent(function () { return () => <div>hi</div> }, "A")

// 手动 setup 风格（return 渲染函数）——插件**不转换**（保持裸函数），
// 但 PD-07 后运行时接受"调用一次返回函数"的裸函数 → 手动 defineComponent 之外也能挂载
function B(props) {
  const n = useSomething()
  return function () { return <div>{n}</div> }
}
// 编译后：保持原样（不包装、不注入 defineComponent）——运行时按"返回 render 函数"兜底挂载
```

> **三个硬性门槛**（缺一不可，见 `wrapComponentFn`）：
> ① 名称首字母大写（`/^[A-Z]/`）；② 函数体以 return 结尾（或箭头 expression body）；
> ③ 返回的是 JSX / `_jsx*()` 调用 / null / 含渲染分支的三元或逻辑表达式。

## 会被自动转换的代码（所有场景）

### A. 声明位置（三种入口）

```tsx
// 1. 具名函数声明
function A() { return <div>hi</div> }

// 2. 变量声明（函数表达式 / 箭头函数）
const B = function (props) { return <p>{props.a}</p> }
const C = () => <span>c</span>

// 3. 默认导出（匿名/具名函数、箭头）
export default () => <div>def</div>
export default function () { return <div>anon</div> }
export default function Named() { return <div>named</div> }
```

### B. 函数体结尾 return 的形态

```tsx
// 1. 直接 return JSX（元素或 Fragment）
function A() { return <div>hi</div> }
function B() { return <><span/></> }

// 2. return _jsx(...)（JSX 已被 rolldown/esbuild 降级，同样识别）
const E2 = function (p) { return _jsx('div', { children: p.x }) }

// 3. return null 结尾（条件渲染收尾）
function C() { if (x) return <div/>; return null }

// 4. return 三元 / 逻辑表达式，且任一分支含 JSX/_jsx（null 分支不单独触发）
function Child(props) { return props.condition ? <Comp /> : null }
function P(props) { return props.ok ? <A /> : <B /> }
function G(p) { return p.a ? (p.b ? <A/> : <B/>) : null }
function C2(p) { return p.condition && <Comp /> }
const C3 = (p) => (p.a ? <A/> : null)

// 5. 箭头函数 expression body（body 本身就是返回值）
const E = () => <span>e</span>
```

### C. 函数体任意位置的早退 return（不只结尾）

```tsx
function F(props) {
  if (props.show) return <div>y</div>   // 早退 → return () => <div>y</div>
  return null                           // 结尾 → return () => null
}
// =》 const F = defineComponent(function (props) {
//       if (props.show) return () => <div>y</div>
//       return () => null
//     })
```

> 早退 return 支持 JSX / `_jsx()` / null / 渲染三元逻辑，可在 `if / switch / 循环` 内部；
> 仅处理函数体自身的 return（`wrapEarlyReturns` 排除嵌套函数——子组件由各自的 visitor 转换）。
> 注意：条件在 setup 期求值**一次**（静态选分支），不是每次渲染重判。

### D. 嵌套子组件（父组件体内的子组件函数也被转换）

```tsx
function App() { function Child() { return <span/> } return <Child/> }
// =》 App 与 Child 各自被包成 defineComponent（Babel 递归遍历全部函数声明）
//     const Child = defineComponent(function(){ return () => <span/> }, "Child")
```

> ⚠️ 嵌套子组件转换后同样是**普通对象**，**不可直接调用**：
> `function AppX(){ function Hello(){ return <div/> } return Hello() }`
> → 嵌套 Hello 被转成 `const Hello = defineComponent(...)`（对象），
> `Hello()` 运行时抛 `TypeError: Hello is not a function`；正确写法 `return <Hello/>`。

### E. 具名插槽 / 作用域插槽（编译期提取为 slots prop）

```tsx
// 仅首字母大写的组件接受（含成员表达式 <Avatar.Root/>）；template 从 children 移除
const Card = () => <Panel><template slot="h">H</template><i>body</i></Panel>
// 作用域插槽：template 上除 slot 外的无值属性名声明为插槽函数参数
const List = () => <ListWrap><template slot="item" item><b>{item}</b></template></ListWrap>
// =》 <Panel slots={{ h: () => <>H</> }}><i>body</i></Panel>
//     <ListWrap slots={{ item: item => <><b>{item}</b></> }} />
```

> 插槽提取递归生效（`walkJSX` / `walkExpression`）：JSX 树内的元素/Fragment/表达式容器、
> `&&` / 三元 / 箭头函数 / 数组 / 对象 / 调用参数中嵌套的 JSX 均会提取；仅字符串字面量
> `slot="name"` 触发。

### F. 转换后统一形态

```js
// 统一生成 defineComponent(fn, name)：
//   name 从变量名传递（function 声明 / 变量声明）；export default 匿名组件无 name
// 文件末尾：有转换发生且无 defineComponent 导入时，自动注入
//   import { defineComponent } from '@actview/core'
```

## 不会被转换的代码

| 场景 | 示例 | 原因 |
|---|---|---|
| 小写命名 | `const small = () => <div/>` | 首字母非大写，视为普通函数 |
| 结尾 return 普通调用表达式 | `function H() { return getElement() }` | 无法静态判定返回值（PD-07 运行时：返回 VNode → 明确报错） |
| 直接调用组件 `return Hello()` | `function AppX() { return Hello() }` | 不转换；运行时 `TypeError: Hello is not a function`——defineComponent 产物是普通对象（call signature 仅类型伪装），**任何路径都不可调用**，正确写法是 `return <Hello/>` |
| 结尾 return 渲染函数（setup 风格） | `function B(p) { return function(){...} }` | 设计约束：组件嵌套方案已废弃，插件不转（PD-07 运行时兜底可用） |
| return 变量引用 | `function H() { return Comp }` | return 的是标识符，无法静态判定是否渲染 |
| 非 JSX 返回 | `function helper() { return 1 }` / `return {a:1}` | 最后 return 不是渲染内容 |
| 纯数值三元 | `function H(p) { return p.a ? 1 : 2 }` | 分支无渲染内容 |
| 空值合并 / 裸 null 分支 | `p.v ?? null` / `a && null` / `p.ok ? null : p.name` | null 分支不单独触发渲染判定 |
| 手动 defineComponent | `const G = defineComponent(function(){...})` | init 是 call 表达式，不重复包装（防双重转换） |
| HOC 包装 | `const X = memo(() => <div/>)` | init 是 call 表达式，非函数字面量 |
| 非函数声明 | `const obj = {...}` / `class X {}` | init 不是函数 |

## 判定逻辑（wrapComponentFn 摘要）

```
最后一条语句的返回值 ret：
  ret 是 JSX 元素 / Fragment                 → 组件，return 包成 () => ret
  ret 是 _jsx/_jsxs/jsx 调用                 → 组件，return 包成 () => ret
  ret 是 null                                → 组件，return 包成 () => null
  ret 是三元/逻辑表达式（任一分支含 JSX/_jsx）→ 组件，return 包成 () => ret
  ret 是函数（渲染函数，setup 风格）          → ❌ 插件不转换（运行时 PD-07 兜底）
  其他                                       → 非组件，跳过
函数体任意位置的早退 return（JSX / _jsx / null / 渲染表达式）同样包成 render 函数
  （wrapEarlyReturns：仅处理函数体自身的 return，排除嵌套函数——子组件由各自 visitor 转换）
```

## 验证

- 插件转换测试：`plugins/babel/test/plugin.test.ts`（34 用例，`npx vitest run plugins/babel/test/plugin.test.ts`）
- 全量回归：`pnpm test`（含 verify / platform-diff / testing 等全部用例）
