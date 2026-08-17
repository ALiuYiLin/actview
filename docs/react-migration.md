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

| React | ActView | 说明 |
|---|---|---|
| `const [x, setX] = useState(0)` | `const x = ref(0)`；读 `x.value`、写 `x.value = 1` | 基本类型必须包 `ref` |
| `const [obj, setObj] = useState({...})` | `const obj = reactive({...})` | 对象/数组用 `reactive`，属性直接改 |
| `setX(x + 1)` | `x.value++` | 直接改，自动触发更新 |
| `useMemo(() => ..., [deps])` | `computed(() => ...)` | 惰性缓存 + 自动依赖追踪 |
| `useEffect(() => {...}, [deps])` | `watch(src, cb)` / `watchEffect(fn)` | 见下方对照 |
| `useRef()` | `ref(null)`（值引用）或模板引用 `props.ref`（函数 / `{value}` / `ref()` 均可） | DOM 引用用模板引用 |
| `useCallback(fn, [])` | **不需要** | 闭包天然稳定 |
| `useContext` | `provide` / `useInjects` | 见第五节 |

### useEffect → watch / 生命周期

```tsx
// React
useEffect(() => { sideEffect(); return cleanup }, [dep])

// ActView：依赖明确用 watch
watch(dep, (newV, oldV, onCleanup) => {
  sideEffect()
  onCleanup(cleanup)
})

// ActView：只挂载/卸载一次用生命周期
onMounted(() => sideEffect())
onUnmounted(() => cleanup())
```

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

---

## 七、内置组件一览

| 组件 | 用途 |
|---|---|
| `<Fragment>` / `<>...</>` | 多根片段 |
| `<KeepAlive>` | 缓存组件实例/DOM，切换不销毁、状态保留 |
| `<ErrorBoundary fallback={...}>` | 捕获子树渲染错误，fallback 可为函数（接收 error） |
| `<Suspense fallback={...}>` | 异步组件加载期间显示 fallback |
| `lazy(() => import('./X'))` | 异步组件（配合 Suspense） |
| `<Teleport to="#target">` | children 渲染到指定容器 |
| `<Transition name="fade" duration={300}>` | 单子节点进入/离开过渡类 |
| `<component is={Comp}>` | 动态组件 |

---

## 八、API 能力清单

### 响应式

| API | 说明 |
|---|---|
| `ref(v)` / `isRef` / `unref` / `toRef` / `toRefs` | 单值响应式与工具 |
| `reactive(obj)` / `shallowReactive` / `readonly` / `markRaw` | 对象/数组响应式 |
| `computed(getter)` / `computed({get,set})` | 派生值（可写） |
| `watch(src, cb, opts)` / `watchEffect(fn)` | 侦听（`immediate`、`onCleanup`、返回 stop） |
| `nextTick(cb?)` | 下次 DOM 更新后回调 |

### 组件与生命周期

| API | 说明 |
|---|---|
| `createApp(Component).mount('#app')` | 应用入口 |
| `defineComponent` | 函数形态（+ 组件名） |
| `onBeforeMount`/`onMounted`/`onUpdated`/`onBeforeUnmount`/`onUnmounted`/`onActivated`/`onDeactivated`/`onErrorCaptured`/`onServerPrefetch`/`onRenderTracked`/`onRenderTriggered` | 生命周期全套（子先父后） |
| `getCurrentInstance()` | 当前组件实例 |
| `provide(k, v)` / `useInjects(k?)` | 依赖注入 |
| `useProp(props, key, fn?)` / `useProps(props, {key: fn})` | props 响应式解构：ComputedRef 活引用 + 默认值/转换 normalize；`key: undefined` 裸透传；批量版返回 `rest`（可 `{...rest.value}` 透传） |

### 渲染与更新

| API | 说明 |
|---|---|
| keyed diff | 带 key 列表 LIS 最小移动 |
| `renderToString(vnode)` | SSR 静态序列化 |
| `v-memo={[deps]}` | 行级显式依赖短路（deps 未变整棵子树复用） |
| `<solid>` | 双模细粒度作用域（见第九节） |

### 路由（`@actview/router`）

| API | 说明 |
|---|---|
| `createRouter({ routes, history })` | 创建路由 |
| `createWebHistory()` / `createMemoryHistory()` | 历史模式 |
| `<RouterLink>` / `<RouterView>` | 链接 / 出口 |

### scoped CSS（`@actview/plugin-scoped`）

```ts
import './style.css?scoped'   // 编译期 data-v-hash 注入 + :deep/:slotted/:global
```

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
