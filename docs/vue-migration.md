# Vue 3 → ActView 迁移指南

> 面向 Vue 3 开发者：ActView 的响应式系统、生命周期、组件模型与 Vue 3 高度一致，但使用 **JSX/TSX** 替代 SFC（`.vue` 单文件组件）。本文档聚焦从 Vue 3 迁移到 ActView 时的模式转换与注意事项。

---

## 一、核心差异：SFC → JSX

Vue 3 用 `<template>` 编写视图，ActView 用 **JSX/TSX**：

| 概念 | Vue 3 | ActView |
|------|-------|---------|
| 组件定义 | `*.vue` 文件（`<template>` + `<script setup>`） | `.tsx`/`.jsx` 文件，函数组件 + Babel 自动转换 |
| 模板语言 | Vue 指令（`v-if`/`v-for`/`v-model`/`v-bind`/`v-on`） | JavaScript 表达式（三元/`map`/受控 value + onChange/展开/`onClick`） |
| 样式 | `<style scoped>` / `<style module>` | 无内置 scoped CSS，使用 `@actview/plugin-scoped` 或 CSS Modules/CSS-in-JS |
| 组件名 | 文件名自动推断 | Babel 插件从函数/变量名传递，或 `defineComponent(fn, name)` |

**不变的部分**：响应式 API、生命周期、provide/inject、computed/watch/watchEffect、模板 refs — 与 Vue 3 几乎一致。

---

## 二、响应式系统（完全兼容）

ActView 的响应式系统直接继承 Vue 3 的设计，API 完全一致：

```tsx
import { ref, reactive, computed, watch, watchEffect } from 'actview'

const count = ref(0)
const state = reactive({ a: 1, b: 2 })
const doubled = computed(() => count.value * 2)

watch(count, (n, o) => console.log(n, o))
watchEffect(() => console.log(count.value))
```

| Vue 3 | ActView | 说明 |
|-------|---------|------|
| `ref()` | `ref()` | 同上 |
| `reactive()` | `reactive()` | 同上 |
| `computed()` | `computed()` | 同上 |
| `watch()` | `watch()` | 同上（含 `flush`/`deep`/`once`/`immediate`） |
| `watchEffect()` | `watchEffect()` | ⚠️ 早退陷阱相同（见下文「注意」） |
| `toRef()` / `toRefs()` | `toRef()` / `toRefs()` | 同上 |
| `isRef()` / `unref()` | `isRef()` / `unref()` | 同上 |
| `shallowRef()` / `triggerRef()` | `shallowRef()` / `triggerRef()` | 同上 |
| `readonly()` / `shallowReadonly()` | `readonly()` / `shallowReadonly()` | 同上 |
| `effectScope()` / `onScopeDispose()` | `effectScope()` / `onScopeDispose()` | 同上 |
| `nextTick()` | `nextTick()` | 同上 |
| `markRaw()` | `markRaw()` | 同上 |
| `toRaw()` | `toRaw()` | 同上 |

> `unrefs(obj)` 为 ActView 扩展（Vue 3 无），批量解包 ref 对象。

---

## 三、组件定义

### SFC → 函数组件

```vue
<!-- Vue 3 SFC -->
<script setup lang="ts">
defineProps<{ name: string }>()
</script>
<template>
  <div>hello {{ name }}</div>
</template>
```

```tsx
// ActView TSX（Babel 插件自动转换为 defineComponent）
export type HelloProps = { name: string }
function Hello(props: HelloProps) {
  return <div>hello {props.name}</div>
}
// 编译后：
// const Hello = defineComponent(function(props: HelloProps) {
//   return () => <div>hello {props.name}</div>
// }, 'Hello')
```

### 组件函数只执行一次

与 Vue 3 的 `<script setup>` 一样，组件函数体只执行一次（setup 阶段），返回的 JSX 被包成渲染函数每次更新执行：

```tsx
function Counter() {
  // ★ 只执行一次（setup）
  const count = ref(0)
  const inc = () => count.value++

  // ★ 这部分包成 render 函数，每次更新执行
  return <div onClick={inc}>{count.value}</div>
}
```

### `defineComponent` 何时需要

| 场景 | 需手动 `defineComponent`？ |
|------|-------------------------|
| 函数组件（`function Hello() { ... }`） | **否**（Babel 插件自动包裹） |
| 大写开头的 `const` 变量 + 函数体 | **否**（插件自动包裹） |
| 箭头函数（`const Hello = () => ...`） | **否**（大写变量 + 箭头函数体自动包裹） |
| 已手动 `defineComponent(fn)` | 保持原样（插件检测到 CallExpression 跳过） |
| `.ts` 文件（非 `.tsx`） | **需要**（Babel 插件只处理 `.tsx`/`.jsx`） |
| 测试中直接调用组件逻辑 | **需要**（无 Babel 转换） |

> ⚠️ 手动 `defineComponent(fn)` 时，`fn` 必须返回**渲染函数**（`() => JSX`），不是直接返回 JSX — 因为插件不会再次包裹已显式包装的函数。

```tsx
// ✅ 正确：手动 defineComponent 返回渲染函数
const Comp = defineComponent(function() {
  const count = ref(0)
  return () => <span>{count.value}</span>
})

// ❌ 错误：直接返回 JSX 会报错（setup 返回的不是函数）
const Comp = defineComponent(function() {
  const count = ref(0)
  return <span>{count.value}</span>   // instance.render 不是函数
})
```

---

## 四、模板语法迁移对照

### 条件渲染

| Vue 3 | ActView |
|-------|---------|
| `<div v-if="ok">yes</div>` | `{ok ? <div>yes</div> : null}` |
| `<div v-else>no</div>` | 三元 `: null` 或 `&&` |
| `<div v-show="ok">x</div>` | `<div style={{ display: ok ? '' : 'none' }}>x</div>` |

### 列表渲染

| Vue 3 | ActView |
|-------|---------|
| `<li v-for="item in list" :key="item.id">{{ item }}</li>` | `{list.map(item => <li key={item.id}>{item}</li>)}` |

> ⚠️ **必须提供 `key`** 属性，否则走无 key 同索引 diff（插入/删除中间项会错位）。

### 事件绑定

| Vue 3 | ActView |
|-------|---------|
| `<button @click="handle">click</button>` | `<button onClick={handle}>click</button>` |
| `<button @click.capture="fn">` | `<button onClickCapture={fn}>` |
| `<button @click.once="fn">` | ⚠️ 不支持 `once` 修饰符（自行包装或 `removeEventListener`） |

### 属性绑定

| Vue 3 | ActView |
|-------|---------|
| `<img :src="url">` | `<img src={url}>` |
| `<div v-bind="obj">` | `<div {...obj}>` |
| `:class="['a', { b: ok }]"` | JS 表达式：`<div class={['a', ok && 'b'].filter(Boolean).join(' ')}>` |
| `:style="{ color: 'red' }"` | `<div style={{ color: 'red' }}>` |

### 表单绑定

Vue 3 的 `v-model` 需拆分为受控值 + 事件：

```tsx
// Vue 3
// <input v-model="text">

// ActView
function Form() {
  const text = ref('')
  return <input value={text.value} onInput={e => text.value = (e.target as HTMLInputElement).value} />
}
```

或封装为自定义 hook：

```tsx
function useModel<T>(initial: T) {
  const value = ref(initial)
  return {
    value,
    onChange: (e: any) => value.value = e.target?.value ?? e,
  }
}

// 使用
<input {...useModel('hello')} />
```

### 插值

| Vue 3 | ActView |
|-------|---------|
| `<span>{{ msg }}</span>` | `<span>{msg}</span>` |
| `v-html="raw"` | `<span dangerouslySetInnerHTML={{ __html: raw }} />` |

### 模板引用

**完全一致**（Vue 3 风格）：

```tsx
const inputRef = ref<HTMLElement | null>(null)
return <input ref={inputRef} />
// 挂载后 inputRef.value = <input> 元素，卸载自动置 null
```

也支持函数形式 `ref={el => ...}` 和普通对象 `ref={{ value: null }}`。

---

## 五、Props 迁移

### Vue 3 `defineProps` → ActView `useProps` / `useProp`

```vue
<!-- Vue 3 <script setup> -->
<script setup lang="ts">
const props = defineProps<{
  variant?: string
  size?: 'sm' | 'lg'
  items: string[]
}>()
</script>
```

```tsx
// ActView
import { useProps } from 'actview'

type BtnProps = {
  variant?: string
  size?: 'sm' | 'lg'
  items: string[]
}

function Btn(props: BtnProps) {
  // useProps 返回 ComputedRef，render 里 .value 读取（活引用）
  const { variant, size, rest } = useProps({
    variant: (v) => v ?? 'default',
    size: undefined,                   // undefined = 裸透传原值
    // items 不在 map 中 → 自动进入 rest
  })
  return (
    <button class={`btn btn-${variant.value} btn-${size.value}`} {...rest.value}>
      {props.children}
    </button>
  )
}
```

| 场景 | Vue 3 | ActView |
|------|-------|---------|
| 声明 props 类型 | `defineProps<{...}>()` | 函数参数 TS 类型标注 |
| props 默认值 | `withDefaults(defineProps<...>(), {...})` | `useProp(key, fn)` 中 `fn` 做兜底 |
| 响应式解构 | `toRefs(props)` 或 Vue 3.5+ `defineProps` 解构 | `useProps(map)` 全部为 ComputedRef |
| 透传未声明 props | `$attrs` / `useAttrs()` | `rest.value`（`{...rest.value}` 展开） |
| 单键取值 | `toRef(props, 'key')` | `useProp('key', fn?)` |

### 组件内单参形式

在组件 setup 内可省略第一个参数（自动取当前实例的 props）：

```tsx
function Button() {
  // 组件内自动取当前实例 props
  const { variant, rest } = useProps({
    variant: (v) => v ?? 'default',
  })
  const count = useProp('count', (v) => v ?? 0)
  // ...
}
```

在 setup 外或需显式指定 props 时用双参形式：`useProps(props, map)` / `useProp(props, key, fn?)`。

> **`props` 对象是原地更新的**：父组件重新渲染时 `updateProps` 修改同一 props 对象的属性值，render 函数里每次读 `props.x` 拿到最新值。**不要**在 setup 层解构 props（会闭包捕获旧值）。

---

## 六、插槽迁移

| 插槽类型 | Vue 3 | ActView |
|----------|-------|---------|
| 默认插槽 | `<slot />` | `{props.children}` |
| 具名插槽 | `<slot name="header" />` | `<template slot="header">`（编译期转换） |
| 作用域插槽 | `<slot :item="item" />` | children 为函数：`{props.children(item)}` |

### 默认插槽

```tsx
// Card 组件
function Card(props) {
  return <div class="card">{props.children}</div>
}
// 使用
<Card>内容</Card>
```

### 具名插槽

```tsx
// Layout 组件（使用方）
<Layout>
  <template slot="header"><h1>标题</h1></template>
  <template slot="footer"><p>尾</p></template>
</Layout>

// Layout 实现（接收方通过 props）
function Layout(props) {
  return (
    <div>
      <header>{props.header}</header>
      <main>{props.children}</main>
      <footer>{props.footer}</footer>
    </div>
  )
}
```

### 作用域插槽

```tsx
// List 组件
function List(props: { items: any[], children?: (scope: { item: any, index: number }) => any }) {
  return (
    <ul>
      {props.items.map((item, index) => (
        <li key={item.id}>{props.children?.({ item, index })}</li>
      ))}
    </ul>
  )
}
// 使用
<List items={data}>
  {(scope) => <span>{scope.index}: {scope.item.name}</span>}
</List>
```

---

## 七、生命周期

**完全一致**，仅调用方式从 `<script setup>` 中的顶层调用变为组件函数体中的顶层调用：

```tsx
function Timer() {
  const count = ref(0)
  let timer: number | undefined

  onMounted(() => {
    timer = setInterval(() => count.value++, 1000)
  })
  onUnmounted(() => {
    clearInterval(timer)
  })

  return <div>{count.value} 秒</div>
}
```

| 生命周期 | Vue 3 | ActView |
|----------|-------|---------|
| 挂载前 | `onBeforeMount` | `onBeforeMount` |
| 挂载后 | `onMounted` | `onMounted`（子先父后） |
| 更新后 | `onUpdated` | `onUpdated` |
| 卸载前 | `onBeforeUnmount` | `onBeforeUnmount` |
| 卸载后 | `onUnmounted` | `onUnmounted` |
| 异步加载 | `onServerPrefetch` | `onServerPrefetch` |
| 调试 | `onRenderTracked` / `onRenderTriggered` | `onRenderTracked` / `onRenderTriggered` |
| KeepAlive | `onActivated` / `onDeactivated` | `onActivated` / `onDeactivated` |
| 错误捕获 | `onErrorCaptured` | `onErrorCaptured` |

---

## 八、依赖注入

### provide / inject（字符串键）

```tsx
// 祖先
provide('theme', 'dark')
provide('count', countRef)   // 传 ref 后代可读写

// 后代
const theme = useInjects('theme')      // 读 'dark'
const all = useInjects()               // 读整个注入表
const count = useInjects('count')      // 读 count ref
```

### Context（React 风格，推荐替代字符串键）

`createContext` 用 Symbol 作键，无键名冲突：

```tsx
import { createContext } from 'actview'

const ThemeCtx = createContext('default')

// 提供（两种方式等价）
<ThemeCtx.Provider value="dark">...</ThemeCtx.Provider>
<ThemeCtx value="dark">...</ThemeCtx>   // React 19 风格

// 消费
function Toolbar() {
  const theme = ThemeCtx.use()           // 返回 Ref，render 读 .value
  return <div class={theme.value}>...</div>
}
```

- **就近覆盖**：内层 Provider 覆盖外层
- 无 Provider 时 `use()` 返回默认值的 ref
- SSR（`renderToString`）同样可用

---

## 九、Composition API / 组合式函数迁移

Vue 3 的组合式函数（composables）模式在 ActView 中完全适用：

```tsx
// Vue 3 composable
export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  onMounted(() => window.addEventListener('mousemove', (e) => { x.value = e.x; y.value = e.y }))
  return { x, y }
}

// ActView 完全一致
export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  onMounted(() => window.addEventListener('mousemove', (e) => { x.value = e.x; y.value = e.y }))
  return { x, y }
}
```

```tsx
function App() {
  const { x, y } = useMouse()
  return <div>鼠标位置：{x.value}, {y.value}</div>
}
```

---

## 十、内置组件迁移

| Vue 3 | ActView | 说明 | 详细参考 |
|-------|---------|------|---------|
| `<Teleport to="#end">` | `<Teleport to="#end">` | 同上 | [→ components.md](./components.md#3-teleport--dom-传送门) |
| `<KeepAlive>` | `<KeepAlive include/exclude/max>` | LRU 缓存 | [→ components.md](./components.md#4-keepalive--组件实例缓存) |
| `<Suspense>` | `<Suspense fallback={...}>` | 异步 setup / lazy | [→ components.md](./components.md#6-suspense--异步加载占位) |
| `<Transition>` | `<Transition name mode appear>` | 单子节点过渡 | [→ components.md](./components.md#1-transition--单子节点过渡动画) |
| `<TransitionGroup>` | `<TransitionGroup>` | 列表过渡 | [→ components.md](./components.md#2-transitiongroup--列表过渡动画) |
| `<component :is="Comp">` | `<component is={Comp}>` | 动态组件 | [→ components.md](./components.md#9-component--动态组件) |
| `<slot>` | `props.children` / 具名插槽 | 见第六节 | — |
| `<template v-slot>` | `<template slot="name">` | 见第六节 | — |
| `<RouterView>` | `<RouterView>`（`@actview/router`） | 同上 | — |
| `<RouterLink>` | `<RouterLink>`（`@actview/router`） | 同上 | — |
| `<Fragment>` | `<>...</>` / `<Fragment>` | 同上 | [→ components.md](./components.md#8-fragment--多根节点片段) |

> 每个内置组件的完整 Props API、代码示例、生命周期关联与注意事项见 `docs/components.md`。

---

## 十一、路由（@actview/router）

与 Vue Router 4 设计一致：

```tsx
import { createRouter, createWebHistory } from '@actview/router'

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: About, children: [
    { path: 'team', component: Team },
  ]},
]

const router = createRouter({ history: createWebHistory(), routes })

// App.tsx
function App() {
  return (
    <>
      <RouterLink to="/">首页</RouterLink>
      <RouterView />
    </>
  )
}
```

| Vue Router 4 | @actview/router |
|--------------|-----------------|
| `createRouter({ history, routes })` | `createRouter({ history, routes })` |
| `createWebHistory()` / `createMemoryHistory()` | 同上 |
| `<RouterLink to>` | 同上 |
| `<RouterView>` | 同上 |
| `router.beforeEach` / `router.afterEach` | 同上 |
| 路由元信息 `meta` | 同上 |
| 嵌套路由 `children` | 同上 |
| 重定向 `redirect` | 同上 |
| 路由级守卫 `beforeEnter` | 同上 |

---

## 十二、状态管理（@actview/store）

与 Pinia 设计一致：

```tsx
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

| Pinia | @actview/store |
|-------|----------------|
| `defineStore(id, setupFn)` | 同上 |
| `storeToRefs(store)` | 同上（保持响应性解构） |
| `$reset()` | `resetStore(store)` / `resetAllStores()` |
| 插件 `store.$subscribe` | `applyPlugin(plugin)` |

---

## 十三、测试迁移

| Vue 3（@vue/test-utils） | ActView（@actview/testing） |
|--------------------------|--------------------------|
| `mount(Comp, { props })` | `render(Comp, { container })` |
| `wrapper.find('div')` | `screen.getByRole()` / `screen.getByText()` |
| `wrapper.trigger('click')` | `fireEvent.click(el)` |
| `await nextTick()` | `await waitFor(() => ...)` |

```tsx
import { render, fireEvent, screen } from '@actview/testing'

test('counter', async () => {
  render(<Counter />)
  const btn = screen.getByRole('button')
  fireEvent.click(btn)
  // 断言...
})
```

> **注意**：`render(component, options)` 的第二个参数是 `options.container`，不是 props。props 直接在 JSX 中传入。

---

## 十四、工程化

| 能力 | Vue 3 | ActView |
|------|-------|---------|
| 构建工具 | Vite + `@vitejs/plugin-vue` | Vite + `@actview/plugin-vite` |
| Babel 转换 | 无需（SFC 由 @vitejs/plugin-vue 处理） | `@actview/plugin-babel` 自动转换 JSX 组件 |
| TypeScript | `.vue` + `vue-tsc` | 原生 `.tsx`，标准 `tsc` |
| Scoped CSS | `<style scoped>` | `@actview/plugin-scoped`（`data-v` 哈希 + `:deep`/`:slotted`/`:global`） |
| 测试 | Vitest + `@vue/test-utils` | Vitest + `@actview/testing` |
| DevTools | Vue DevTools | `@actview/devtools` |

---

## 十五、注意事项（💡 易错点）

### 1. `watchEffect` 早退陷阱

与 Vue 3 相同：`watchEffect` 回调中如果在读取任何响应式依赖之前就 `return`（早退），后续不会追踪依赖。必须确保在早退前至少读取一次目标依赖或使用 `void dep` 标记。

### 2. 组件函数体 = setup

组件函数体只执行一次，**不要在顶层解构 props**（快照旧值）。要么在 JSX 中直接读 `props.x`，要么用 `useProps`/`useProp` 获取活引用。

### 3. `<script setup>` 顶层 await

Vue 3 的 `<script setup>` 支持顶层 `await`（自动转换为异步组件），ActView 中需要显式使用 `<Suspense>` + `lazy()`：

```tsx
const AsyncComp = lazy(() => import('./HeavyComp'))

function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <AsyncComp />
    </Suspense>
  )
}
```

### 4. 模板 ref 的类型

与 Vue 3 一致：`ref<HTMLElement | null>(null)` 挂载后自动赋值，卸载自动置 null。

### 5. `createElement` 导入

在测试或非 JSX 场景中需要 `createElement` 时，从 `@actview/jsx` 导入（不是从 `actview`）：

```tsx
import { createElement } from '@actview/jsx'
```

### 6. 数组必须加 key

列表渲染中**必须提供 `key` 属性**（与 React 相同），否则增删中间项会错位。Vue 3 中 `:key` 非强制但推荐，ActView 中无 key 走同索引 diff。

---

> 完整 API 清单见 `docs/API.md`。React 开发者迁移对照见 `docs/react-migration.md`。