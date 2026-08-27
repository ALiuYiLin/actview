# React → ActView 迁移指南

> 面向 React 开发者：如何把 React 的思维与写法迁移到 ActView，哪些写法是**错误**的、应该怎么写，以及 ActView 的 API 能力与内置组件。
> 先读「核心差异」一节——这是所有迁移坑的根源。

---

## 一、核心差异：组件函数只执行一次

这是 ActView 与 React 最本质的区别，几乎所有错误写法都源于此：

| | React | ActView |
|---|---|---|
| 组件函数体 | **每次 render 都重新执行** | **只执行一次（setup 阶段）** |
| 返回的 JSX | 每次 render 生成新的 VNode | 包成 `render` 函数，**每次更新时执行** |
| 状态 | `useState` / `useReducer` | 响应式 `ref` / `reactive` |
| 更新驱动 | 重新执行函数 | 响应式依赖追踪 + 局部 re-render |

```tsx
// 源码
function App() {
  const count = ref(0)          // ① setup：只执行一次
  function inc() { count.value++ }
  return <div onClick={inc}>{count.value}</div>  // ② render：每次更新执行
}
// 编译后（@actview/plugin-babel 自动转换）
const App = defineComponent(function () {
  const count = ref(0)
  function inc() { count.value++ }
  return () => <div onClick={inc}>{count.value}</div>  // 只有这部分会重跑
})
```

**结论**：需要"每次渲染重算"的东西，要么放进 JSX 表达式（render 函数内），要么用 `computed`；不能写在组件函数体的 setup 层。

---

## 二、状态管理迁移对照

### 1. `useState` → `ref` / `reactive`

```tsx
// ─── React ───
const [count, setCount] = useState(0)
const [user, setUser] = useState({ name: 'a', age: 20 })

// ─── ActView ───
const count = ref(0)                         // 基本类型 → ref
const user  = reactive({ name: 'a', age: 20 }) // 对象/数组 → reactive

// 读取
count.value                // → 相当于 React 的 count
user.name                  // → 相当于 React 的 user.name

// 修改
count.value++              // → 相当于 setCount(c => c + 1)
user.name = 'b'            // → 相当于 setUser(u => ({...u, name: 'b'}))
```

**要点**
- **基本类型**（`number`/`string`/`boolean`）必须用 `ref`，通过 `.value` 读写
- **对象/数组**用 `reactive`，属性直接修改即触发更新，无需创建新对象
- `ref` 的对象值自动深层响应式（`ref({ a: 1 })` 等价于 `reactive({ a: 1 })` 包了一层 `.value`）

---

### 2. `useMemo` → `computed`

```tsx
// ─── React ───
const doubled = useMemo(() => count * 2, [count])

// ─── ActView ───
const doubled = computed(() => count.value * 2)
```

- **惰性缓存**：依赖未变时不重算（React 是缓存结果，ActView 是脏标记判断）
- **自动依赖追踪**：`computed` 回调中读取哪些响应式变量，就自动订阅哪些，无需写依赖数组
- 返回 `ComputedRef`，用 `.value` 读取（和 `ref` 一样）

---

### 3. `useRef` → `ref`（值引用 / DOM 引用）

```tsx
// ─── 场景 A：可变引用（不触发渲染）───

// React
const intervalRef = useRef<number>(0)
intervalRef.current = setInterval(...)

// ActView
const intervalRef = ref<number>(0)   // ref 本身不触发渲染——值变化只影响 .value
// 或用普通变量（组件函数只跑一次，闭包天然稳定）
let intervalId: number | undefined
```

对于「不需要触发渲染的跨渲染期存储」，ActView 中可以直接用 **普通局部变量**（因为组件函数只执行一次，不存在 React 那种每次 render 重置的问题）：

```tsx
function Timer() {
  let intervalId: number | undefined   // ✅ 天然稳定，无需 useRef 包装

  onMounted(() => { intervalId = setInterval(...) })
  onUnmounted(() => { clearInterval(intervalId) })
  // ...
}
```

```tsx
// ─── 场景 B：DOM 引用（模板引用）───

// React
const inputRef = useRef<HTMLInputElement>(null)
return <input ref={inputRef} />

// ActView（三种方式均可）
const inputRef = ref<HTMLInputElement | null>(null)  // ① ref() 对象
// const inputRef = { value: null }                  // ② 普通对象
return <input ref={inputRef} />                      // 挂载后 inputRef.value = <input>

// ③ 函数形式
let inputEl: HTMLInputElement | null = null
return <input ref={(el) => { inputEl = el }} />
```

---

### 4. `useCallback` → **不需要**

```tsx
// React：需要 useCallback 保持闭包引用稳定
const handleClick = useCallback(() => { doSomething(dep) }, [dep])

// ActView：闭包天然稳定（组件函数只执行一次），直接写即可
function MyComp() {
  const dep = ref(0)
  const handleClick = () => { doSomething(dep.value) }  // ✅ 始终保持同一引用
  return <button onClick={handleClick}>click</button>
}
```

**原因**：React 的组组件函数每次 render 重新执行，需要用 `useCallback` 保持子组件 `memo` 判断时的引用稳定。ActView 的组件函数只执行一次，闭包在 setup 阶段创建后永不变化，不存在此问题。

---

### 5. `useContext` → `createContext`

```tsx
// ─── React ───
const ThemeCtx = createContext('default')
<ThemeCtx.Provider value="dark">
  <Toolbar />
</ThemeCtx.Provider>
const theme = useContext(ThemeCtx)   // "dark"

// ─── ActView ───
const ThemeCtx = createContext('default')   // import from 'actview'

// 提供（两种写法等价）
<ThemeCtx.Provider value="dark">...</ThemeCtx.Provider>
<ThemeCtx value="dark">...</ThemeCtx>            // React 19 风格

// 消费
function Toolbar() {
  const theme = ThemeCtx.use()          // 返回 Ref
  return <div class={theme.value}>...</div>  // render 里 .value 读取
}
```

**差异**
| | React Context | ActView Context |
|---|---|---|
| 消费返回值 | 裸值 | `Ref`（`render` 中 `.value` 读取，建立响应式追踪） |
| 更新驱动 | `setState` 导致 Provider 重渲染 | value 变化自动触发消费方重渲染 |
| 就近覆盖 | 同 | 同 |
| SSR | 需手动处理 | 自动支持（`renderToString` 线程注入） |

---

### 6. `useEffect` → `watch` / 生命周期

React 的 `useEffect` 承担了三种不同的职责，ActView 中需要分别对应：

#### 场景 A：侦听依赖变化 → `watch`

```tsx
// React
useEffect(() => {
  saveToStorage(count)
  return () => cleanup()
}, [count])

// ActView
watch(count, (newVal, oldVal, onCleanup) => {
  saveToStorage(newVal)
  onCleanup(() => cleanup())          // 清理函数注册（下次运行或停止时调用）
})
```

- `watch` 需要显式指定侦听的源（ref / getter 函数 / 数组）
- 回调参数 `(newValue, oldValue, onCleanup)` 与 Vue 3 一致
- `onCleanup` 注册的清理函数在下次运行前或 `watch` 停止时自动调用（等价于 React useEffect cleanup）

#### 场景 B：只跑一次的副作用（挂载/卸载）→ 生命周期钩子

```tsx
// React
useEffect(() => {
  fetchData()
  return () => cancelRequest()
}, [])          // 空依赖数组

// ActView
onMounted(() => {
  fetchData()
})
onUnmounted(() => {
  cancelRequest()
})
```

#### 场景 C：自动追踪副作用的响应式依赖 → `watchEffect`

```tsx
// React（需要手动列出所有依赖）
useEffect(() => {
  console.log(count, name)
}, [count, name])

// ActView（自动追踪回调中读取的所有响应式依赖）
watchEffect(() => {
  console.log(count.value, name.value)
})
```

- `watchEffect` 立即执行一次回调，过程中读取了哪些 ref/reactive 就自动订阅哪些
- 无需写依赖数组（与 React `useEffect` 需手动列出依赖形成对比）
- ⚠️ **注意**：回调中如果条件早退（在读取任何响应式值之前 `return`），后续依赖不会收集——与 Vue 3 一致

#### 对照一览

| React `useEffect` 用法 | ActView 对应 | 说明 |
|---|---|---|
| `useEffect(fn, [dep1, dep2])` | `watch([dep1, dep2], fn)` | 依赖变化时触发回调 |
| `useEffect(fn, [])` | `onMounted(fn)` + `onUnmounted(cleanup)` | 仅挂载/卸载 |
| `useEffect(fn)`（无依赖数组） | `watchEffect(fn)` | 自动追踪 + 立即执行 |
| `useLayoutEffect` | 用 `queueJob` 机制（默认同步微任务，等价） | 无需特殊 API |

---

### 7. `useReducer` → `reactive` + 函数

```tsx
// ─── React ───
const [state, dispatch] = useReducer(reducer, initialState)

// ─── ActView ───
const state = reactive(initialState)
function dispatch(action: { type: string; payload?: any }) {
  switch (action.type) {
    case 'inc': state.count++; break
    case 'set': state.count = action.payload; break
  }
}
```

对于复杂状态逻辑，`reactive` 直接修改属性比 reducer 更简洁。如果确实需要 reducer 模式（如 Redux 迁移），可以封装：

```tsx
function useReducer(reducer: Function, initial: any) {
  const state = reactive(initial)
  const dispatch = (action: any) => {
    const next = reducer({ ...state }, action)
    Object.assign(state, next)
  }
  return [state, dispatch]
}
```

---

### 8. 状态管理库：Pinia / Zustand / Redux → `@actview/store`

```tsx
// ─── Zustand / Redux ───
const useStore = create((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}))

// ─── Pinia ───
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: { inc() { this.count++ } },
})
```

```tsx
// ─── ActView（@actview/store，setup 语法与 Pinia 一致）───
import { defineStore } from '@actview/store'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)

  function inc() { count.value++ }

  return { count, doubled, inc }
})

// 组件中使用
function App() {
  const store = useCounterStore()
  return <div onClick={store.inc}>{store.count}</div>
}
```

| | Zustand / Redux | Pinia | `@actview/store` |
|---|---|---|---|
| 定义 | `create((set) => ...)` | `defineStore(id, options/setup)` | `defineStore(id, setupFn)` |
| 状态 | 不可变更新（`set`/`dispatch`） | 直接改（`this.count++`） | 直接改（`count.value++`） |
| 派生 | `useMemo` / selector | `getters` | `computed` |
| 响应式 | 手动订阅 | Vue 响应式 | ActView 响应式 |

> `@actview/store` 的 `defineStore` 接受 setup 函数（与 Pinia setup 语法完全一致）。详细 API 见 `docs/API.md`。

---

## 三、组件与 props

### 定义组件

```tsx
// ✅ 函数组件（裸函数，插件自动转 defineComponent，props 类型用 TS 声明）
export type HelloProps = { name: string }
function Hello(props: HelloProps) {
  return <div>hi {props.name}</div>
}
```

> ⚠️ **唯一合法形态是「最后 return JSX」**。`return function() {...}`（React 常见的高阶组件/渲染函数写法）**不允许**，会报 `InvalidCharacterError`。

### props 访问与响应式

**props 对象是原地更新的**（父组件更新时 `updateProps` 原地改写同一对象），render 函数里每次读 `props.x` 拿到最新值。

```tsx
// ✅ 正确：render 里直接读 props
function Child(props: { count: number }) {
  return <div>{props.count}</div>
}

// ❌ 错误：在 setup 层解构 props 会闭包捕获旧值
function Child(props: { count: number }) {
  const { count } = props       // setup 只执行一次，count 永远是初值
  return <div>{count}</div>     // 父更新后这里不刷新
}
```

**需要解构时用 `useProps` / `useProp`**（返回 ComputedRef 活引用，不丢响应性）：

```tsx
import { useProps, useProp } from 'actview'

function Button() {
  // 组件内可省略 props 参数（自动取当前实例 props，等价 Vue 的 toRefs(props) + 默认值）
  const { variant, size, rest } = useProps({
    class: undefined,                 // undefined = 裸透传：直接返回 props.class 原值
    variant: (v) => v ?? 'default',   // normalize：默认值兜底 / 类型转换
    size: (v) => v ?? 'default',
  })
  return (
    <button {...rest.value} class={`btn btn-${variant.value} btn-${size.value}`}>
      {props.children}
    </button>
  )
}

// 单键：useProp(key, normalize?)（组件内单参形式）
const count = useProp('count', (v) => v ?? 0)
```

- 组件内**单参形式**（`useProps(map)` / `useProp(key, fn?)`）自动取当前实例的 props；setup 外或需显式指定时用双参形式（`useProps(props, map)` / `useProp(props, key, fn?)`）
- 返回的都是 `ComputedRef`：render 里用 `.value` 读取，父组件改 prop 自动重算
- `rest.value` 是未在 map 中声明的 props 集合（值形态），可直接 `{...rest.value}` 透传；父组件新增的 prop 键会自动进入 rest
- 别名键：map 用真实键（`class`），解构时重命名（`{ class: className }`）；不声明 normalize 的键用 `key: undefined` 裸透传，无需写 `(val) => val`
- 纯透传场景（不剔除任何键）直接 `{...props}` 即可，无需 useProps

### 子组件更新时机

父组件 re-render 时，子组件通过 `patchComponent` 判断 `propsChanged`（浅比较）：props 引用/值变了才 update 子组件，否则跳过。**这就是为什么大列表里"行组件 + 不可变数据"能短路**。

---

## 四、常见错误写法（重点）

| 错误写法 | 问题 | 正确写法 |
|---|---|---|
| `let count = 0` 直接渲染 | 普通变量不响应 | `const count = ref(0)` |
| 组件函数体里写派生逻辑 `const d = a + b` | setup 只执行一次，d 永远旧值 | `computed(() => a + b)` 或写进 JSX |
| `return function() {...}` | 渲染函数形态已废弃 | `return <JSX/>` |
| 事件里改普通变量 | 不触发更新 | 改 `ref.value` / `reactive` 属性 |
| `const {x} = props` 再渲染 | 闭包捕获旧 props | JSX 里读 `props.x`，或 `useProps` 解构活引用 |
| `useState/useEffect/useMemo` | 这些 Hooks 不存在 | 用 ref/reactive/watch/computed |
| 数组 `map` 不加 `key` | 增删中间项会错位（无 key 走同索引 diff） | `items.map(x => <Row key={x.id} />)` |
| `className` | 兼容，但非原生 | 用 `class`（`className` 也会被正确映射，建议统一 `class`） |
| 直接给对象赋值新对象 `state = {...}` | `reactive` 变量重新赋值丢代理 | 改属性，或改用 `ref({...})` 后 `.value = {...}` |

### 响应式对象重新赋值的坑

```tsx
// ❌ reactive 不能整体重新赋值（丢代理）
let state = reactive({ a: 1 })
state = { a: 2 }        // 错：state 不再是响应式代理

// ✅ 改属性
state.a = 2

// ✅ 或需要整体替换时用 ref
const state = ref({ a: 1 })
state.value = { a: 2 }
```

---

## 五、事件、列表、插槽

### 事件

```tsx
// onClick / onInput / onSubmit...（与 React 一致）；capture 用 onXxxCapture
<button onClick={handle} onFocusCapture={onFocus}>ok</button>
```

### 列表渲染

```tsx
{rows.map((row) => (
  <tr key={row.id}>...</tr>
))}
```

### 插槽（三种）

```tsx
// 默认插槽：children 透传
function Card(props) { return <div class="card">{props.children}</div> }
<Card>内容</Card>

// 作用域插槽：children 是函数
function List(props) { return <ul>{props.children({ item: 1 })}</ul> }
<List>{(scope) => <li>{scope.item}</li>}</List>

// 具名插槽：编译期 <template slot="name">
<Layout>
  <template slot="header"><h1>title</h1></template>
  <template slot="footer"><p>foot</p></template>
</Layout>
```

### 无头组件 render-prop（默认实现 + 用户可覆盖）

无头组件库（Headless UI）的常见模式：组件提供**默认渲染**，用户通过 `render` 函数 prop **自行重实现**。ActView 完全支持，且 render prop 不经 defineComponent 转换（它是普通函数 prop，返回 VNode）：

```tsx
// 库侧：默认实现 + 用户覆盖
function Combobox(props) {
  return !props.render ? (
    <div class="combobox-default">...</div>
  ) : (
    <>{props.render({ open: true })}</>   // 渲染期调用，返回 VNode
  )
}

// 用户侧：传 render 覆盖
<Combobox render={(state) => <div class="my-combobox">{state.open ? '开' : '关'}</div>} />
```

- **响应式成立**：`props.render(...)` 在 Combobox 的 render effect 里调用，render 箭头内读取的响应式状态会追踪到 Combobox 的 render——状态变化自动重渲染、重新调用 render prop
- `!props.render ? A : B` 三元在 render 函数内部求值（每次渲染重判），props.render 的增删是响应式的
- 等价写法对照：函数 children（`<Combobox>{(s) => <div/>}</Combobox>`，需判断 children 是函数还是 VNode）、具名插槽（`<template slot="render" state>` → `props.slots.render({})`）

#### 推荐：用具名插槽替代 render prop（无类型歧义）

功能与 render prop 完全等价，但推荐优先用**具名插槽**——编译期提取、无 children 类型歧义、作用域参数显式声明：

```tsx
// 库侧：插槽回退默认实现（slots 一定有函数形态，无需判空分支）
function Combobox(props) {
  return props.slots?.render?.({ open: true }) ?? (
    <div class="combobox-default">...</div>
  )
}

// 用户侧：具名插槽覆盖（`state` 为作用域参数，接收库侧传入的状态）
<Combobox>
  <template slot="render" state>
    <div class="my-combobox">{state.open ? '开' : '关'}</div>
  </template>
</Combobox>
```

- 编译产物：`slots: { render: (state) => <><div class="my-combobox">...</div></> }`——与 render prop 同一机制，`props.slots.render(...)` 在库组件 render effect 中调用，响应式追踪同样成立
- 优势：作用域参数（`state`）在 JSX 上显式声明，`slot="render"` 语义即"渲染接口"，用户不需要写内联箭头闭包；多个渲染出口（`slot="label"` / `slot="icon"` / `slot="render"`）并列清晰

> 📖 **无头组件库（Base UI 风格）整体迁移**（forwardRef / useRenderElement / state 注入的转换规则 + Separator 完整示例）见 [`docs/headless-components.md`](./headless-components.md)

### 模板引用（DOM 引用）

```tsx
// ✅ Vue 风格：ref() 直接传（挂载后 inputRef.value = <input>，卸载自动置 null）
const inputRef = ref<HTMLElement | null>(null)
return <input ref={inputRef} />

// ✅ 普通对象：ref={ { value: null } }（同上，`.value` 指向元素）
// ✅ 函数回调：ref={(n) => (el = n)}
// 组件引用：ref 指向组件实例（非 DOM）
```

---

## 六、依赖注入（provide / useInjects）

跨层级传数据，避免 props 逐层透传：

```tsx
// 祖先
provide('theme', 'dark')
provide('count', count)   // 传 ref，后代可读写

// 后代
const theme = useInjects('theme')
```

`provide` 只能在组件 setup 中调用；`useInjects(key?)` 读注入表（`useInjects()` 读整表）。

### Context（React 风格，推荐替代字符串键）

`createContext` 用**对象身份作键**（内部 Symbol），无需手动防键名冲突。存值语义为 **store-as-is**（原样存储,不包 ref/不 watch）——响应式由传入对象携带:

```tsx
import { createContext } from 'actview'

const ThemeCtx = createContext({ theme: 'light' })   // 默认值（无 Provider 时生效）;动态值传响应式对象

// 提供（两种写法等价;值传响应式对象/装ref容器/rawRef,勿传快照）：
<ThemeCtx.Provider value={state}>...</ThemeCtx.Provider>
<ThemeCtx value={state}>...</ThemeCtx>          // React 19 风格

// 消费（use() 返回原样值;读响应式数据即建立追踪）：
function Toolbar() {
  const state = ThemeCtx.use()
  return <div class={state.theme}>...</div>
}
```

- **就近覆盖**：内层 Provider 覆盖外层；嵌套多层各自响应式互不影响
- 无 Provider 时 `use()` 返回默认值（原样）；SSR（`renderToString`）同样可用
- ⚠️ 传快照值（如 `value={state.theme}`）= 注入静态值,变化不传播——动态值请传响应式引用

---

## 七、内置组件一览

| 组件 | 用途 | 详细参考 |
|---|---|---|
| `<Fragment>` / `<>...</>` | 多根片段 | [→ components.md](./components.md#8-fragment--多根节点片段) |
| `<KeepAlive>` | 缓存组件实例/DOM，切换不销毁、状态保留 | [→ components.md](./components.md#4-keepalive--组件实例缓存) |
| `<ErrorBoundary fallback={...}>` | 捕获子树渲染错误，fallback 可为函数（接收 error） | [→ components.md](./components.md#5-errorboundary--渲染错误边界) |
| `<Suspense fallback={...}>` | 异步组件加载期间显示 fallback | [→ components.md](./components.md#6-suspense--异步加载占位) |
| `lazy(() => import('./X'))` | 异步组件（配合 Suspense） | [→ components.md](./components.md#7-lazy--异步组件工厂) |
| `<Teleport to="#target">` | children 渲染到指定容器 | [→ components.md](./components.md#3-teleport--dom-传送门) |
| `<Transition name="fade" duration={300}>` | 单子节点进入/离开过渡类 | [→ components.md](./components.md#1-transition--单子节点过渡动画) |
| `<component is={Comp}>` | 动态组件 | [→ components.md](./components.md#9-component--动态组件) |

> 每个内置组件的完整 Props API、代码示例、生命周期关联、注意事项见 `docs/components.md`。

---

## 八、API 能力清单

> 完整 API 清单见 `docs/API.md`。以下仅列迁移相关的关键对照。

### 组件与生命周期

| API | 说明 |
|---|---|
| `defineComponent` | 函数形态（+ 组件名），`setup` 只执行一次、返回 render 函数 |
| 生命周期（`onMounted`/`onUpdated`/`onBeforeUnmount`/`onUnmounted` 等） | React 迁移对照见第二节「useEffect → 生命周期」 |
| `provide(k, v)` / `useInjects(k?)` | 依赖注入（`createContext` 推荐替代，防止 string key 碰撞） |
| `useProp(key, fn?)` / `useProps({key: fn})` | props 响应式解构 + 默认值/rest 透传（见第三节「props 访问与响应式」示例） |

### 渲染与更新

| 能力 | 说明 |
|---|---|
| keyed diff | 带 key 列表 LIS 最小移动 |
| `v-memo={[deps]}` / `<solid>` | 行级 / 细粒度更新（见第九节） |

> 响应式 API（`ref`/`reactive`/`computed`/`watch`/`watchEffect`）详见 `docs/API.md` 第一节 `docs/reactivity.md`。

---

## 九、性能：v-memo 与 `<solid>` 双模

### v-memo（行级短路）

```tsx
<tr v-memo={[row.label, row.id === selected.value]} key={row.id}>
  ...
</tr>
```

deps 未变时整棵子树跳过 render/diff/DOM 操作，适合大列表局部更新。

### `<solid>` 双模细粒度

热点区域（高频更新的局部）编译为 DOM 直连 effect，块外保持 Vue 式 re-render：

```tsx
<table><tbody>
  <solid>
    {rows.map((r) => (
      <tr key={r.id} class={r.id === selected.value ? 'danger' : ''}>
        <td>{r.id}</td>
        <td>{r.label}</td>
      </tr>
    ))}
  </solid>
</tbody></table>
```

- 块内 DOM 骨架创建一次，每个 `{expr}` 是独立 effect 直连 DOM
- 数组走 `mapArray` 项级 keyed 复用（公共前后缀跳过 + LIS 最小移动）
- 数据靠闭包捕获外层 `ref`/`reactive`，不支持 props 桥接（父 re-render 的 props 变化传不进边界）

> 详见 `docs/perf-optimization.md`。
