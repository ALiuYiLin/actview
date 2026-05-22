# Actview

轻量级前端框架，融合 **Vue 风格的响应式系统** 与 **React 风格的 JSX**，基于 Proxy 和自定义 JSX 工厂从零实现。

## 安装

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## 响应式系统

### ref — 基础类型

```tsx
import { ref, computed, watch } from "@actview/core"

const count = ref(0)

// 读取: count.value
// 写入: count.value = 1
console.log(count.value) // 0
count.value++
console.log(count.value) // 1
```

### reactive — 对象与数组

```tsx
const user = reactive({ name: "Actview", age: 3 })
const list = reactive([{ id: 1, text: "条目 A" }])

console.log(user.name) // "Actview"
user.age = 4           // 触发更新

list.push({ id: 2, text: "条目 B" }) // 触发更新
```

### computed — 计算属性

```tsx
const name = ref("Actview")
const version = ref(1)

const info = computed(() => `${name.value} v${version.value}`)

console.log(info.value) // "Actview v1"
```

### watch — 侦听器

```tsx
const count = ref(0)

watch(count, (newVal, oldVal) => {
  console.log(`count: ${oldVal} → ${newVal}`)
})

count.value = 1 // 输出 "count: 0 → 1"
```

### 原理

Actview 使用 **Proxy** 拦截响应式数据的读写。组件渲染函数中读取的 ref 会自动建立订阅关系。数据变更时，仅依赖该数据的组件重新渲染。

```tsx
const count = ref(0)

function Counter() {
  return () => <div>{count.value}</div>  // 订阅 count
}
```

## 组件

### Setup 模式（推荐）

组件函数执行一次（setup），返回渲染函数（render），每次更新时重新执行渲染函数：

```tsx
function Counter() {
  const count = ref(0)

  return () => (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>+1</button>
    </div>
  )
}
```

- **Setup 阶段**：创建 ref、computed、watch 等，只执行一次
- **Render 阶段**：返回 JSX，自动追踪响应式依赖，每次更新重新执行

### 直接模式（无状态）

组件函数本身就是渲染函数，父组件每次渲染都会重新执行：

```tsx
function Greeting(props: { name: string }) {
  return <div>你好，{props.name}！</div>
}
```

无内部状态，无独立响应式边界，纯 props 输入 / JSX 输出。

### Props

```tsx
function Welcome(props: { title: string; count: number }) {
  return () => (
    <div>
      <h2>{props.title}</h2>
      <p>Count: {props.count}</p>
    </div>
  )
}

// 使用
<Welcome title="Hello" count={count.value} />
```

## JSX & DOM 渲染

Actview 使用 **自定义 JSX 工厂**（`createElement`）直接创建真实 DOM，无虚拟 DOM：

```tsx
// JSX → createElement → 真实 DOM
const element = <div class="card">
  <h3>标题</h3>
  <p>内容</p>
</div>
```

### 响应式更新（组件级）

```tsx
function Timer() {
  const time = ref(new Date().toLocaleTimeString())

  setInterval(() => {
    time.value = new Date().toLocaleTimeString()
  }, 1000)

  return () => <div>当前时间: {time.value}</div>
}
```

- `time.value` 变化 → 触发 `publish`
- 仅该组件的 `componentUpdateFn` 重新执行
- 对比新旧 DOM，仅更新变化的节点

### Fragment

```tsx
function List() {
  return () => (
    <>
      <h2>列表</h2>
      {items.map(item => <div key={item.id}>{item.text}</div>)}
    </>
  )
}
```

Fragment 用 `DocumentFragment` 包含子节点，配合首尾锚点注释节点实现稳定 diff。

### Keyed Reconciliation

子节点带有 `key` 属性时按标识符匹配，保留 DOM 状态（如输入框内容）：

```tsx
function SortableList() {
  const items = reactive([
    { id: 1, text: "A" },
    { id: 2, text: "B" },
  ])

  return () => (
    <>
      {items.map(item => (
        <div key={item.id}>
          <input placeholder={item.text} />
        </div>
      ))}
      <button onClick={() => items.sort(() => Math.random() - 0.5)}>
        随机排序
      </button>
    </>
  )
}
```

无 key 时随机排序会导致输入框内容错位，有 key 时每个输入框跟随其 `div`。

## 插槽

命名插槽使用 `<template slot="xxx">` 语法。模板内的内容会被提取为 `props.xxx` 传入组件。未包裹在 `<template slot>` 中的内容归入 `props.children`（默认插槽）。

### 定义带插槽的组件

```tsx
function Card() {
  return (props: any) => (
    <div class="card">
      {props.header && <div class="card-header">{props.header}</div>}
      <div class="card-body">{props.children}</div>
      {props.footer && <div class="card-footer">{props.footer}</div>}
    </div>
  )
}
```

### 使用插槽

```tsx
<Card>
  <template slot="header">
    <span>📌</span>
    <strong>标题</strong>
  </template>

  <p>主体内容 — 会成为 props.children。</p>

  <template slot="footer">
    <span>底部信息</span>
  </template>
</Card>
```

### 原理

在 `createElement` 中，传递给组件的子节点会被遍历：

1. 命中的 `<template slot="xxx">` 提取其 `content.childNodes` 作为命名 prop
2. 其余节点归入 `props.children`

```ts
// 插槽解析伪代码
for (const child of allChildren) {
  if (child instanceof HTMLTemplateElement && child.getAttribute("slot")) {
    const slotName = child.getAttribute("slot")!
    mergedProps[slotName] = Array.from(child.content.childNodes)
  } else {
    defaultChildren.push(child)
  }
}
mergedProps.children = defaultChildren
```

## 路由

Actview 内置客户端路由，支持嵌套。

### 配置

```tsx
import { Router } from "@actview/router"
import { Home } from "./pages/home"
import { About } from "./pages/about"

const routes = [
  { path: "/", component: Home },
  { path: "/about", component: About },
  { path: "/admin", component: AdminLayout, children: [
    { path: "/admin/users", component: Users },
    { path: "/admin/settings", component: Settings },
  ]},
]

new Router({ routes })
```

### 导航

```tsx
import { useRouter } from "@actview/router"

function NavBar() {
  const router = useRouter()

  return () => (
    <nav>
      <a onClick={() => router.push("/")}>首页</a>
      <a onClick={() => router.push("/about")}>关于</a>
    </nav>
  )
}
```

### RouterView

```tsx
import { RouterView } from "@actview/router"

function App() {
  return () => (
    <div>
      <NavBar />
      <RouterView />  {/* 渲染匹配当前路由的组件 */}
    </div>
  )
}
```

嵌套路由时，在父布局组件中放置 `<RouterView />`，自动渲染当前深度的子路由。

## 架构

```
packages/
  core/         响应式系统 (ref, reactive, computed, watch) + EventBus
  jsx/          自定义 JSX 工厂 (createElement, mountComponent, diffElement)
  router/       客户端路由，支持嵌套
  actview/      统一导出
```

### Diff 算法

`diffElement` 直接比较两个真实 DOM 节点（无虚拟 DOM）：

1. **类型不同** → 替换
2. **文本节点** → 更新 `textContent`
3. **组件边界** → 跳过（组件自己管理子树）
4. **相同元素** → 同步属性 → 协调子节点（key 匹配或索引匹配）

组件边界隔离意味着父组件重新渲染时不会深入到子组件内部。每个组件拥有独立的 `componentUpdateFn`，仅在自身依赖的响应式数据变化时执行。

## License

MIT
