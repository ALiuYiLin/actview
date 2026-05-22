# Actview

A lightweight frontend framework with **Vue-like reactivity** and **React-like JSX**, built from scratch with Proxy and a custom JSX factory.

## Installation

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Reactivity System

### ref — Primitive Values

```tsx
import { ref, computed, watch } from "@actview/core"

const count = ref(0)

// Read: count.value
// Write: count.value = 1
console.log(count.value) // 0
count.value++
console.log(count.value) // 1
```

### reactive — Objects & Arrays

```tsx
const user = reactive({ name: "Actview", age: 3 })
const list = reactive([{ id: 1, text: "Item A" }])

console.log(user.name) // "Actview"
user.age = 4           // triggers update

list.push({ id: 2, text: "Item B" }) // triggers update
```

### computed — Derived Values

```tsx
const name = ref("Actview")
const version = ref(1)

const info = computed(() => `${name.value} v${version.value}`)

console.log(info.value) // "Actview v1"
```

### watch — Side Effects

```tsx
const count = ref(0)

watch(count, (newVal, oldVal) => {
  console.log(`count: ${oldVal} → ${newVal}`)
})

count.value = 1 // logs "count: 0 → 1"
```

### How It Works

Actview uses **Proxy** to intercept get/set on reactive data. When a ref is read inside a component's render function, the component automatically subscribes to that ref. When the ref changes, only the components that read it are re-rendered.

```tsx
const count = ref(0)

function Counter() {
  return () => <div>{count.value}</div>  // subscribes to `count`
}
```

## Components

### Setup Mode (Recommended)

The component function runs once (setup), returns a render function that re-runs on each update:

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

- **Setup** runs once: create refs, computed, watch
- **Render** runs on each update: returns JSX, auto-tracks reactive dependencies

### Direct Mode (Stateless)

The component function IS the render function — re-runs on every parent render:

```tsx
function Greeting(props: { name: string }) {
  return <div>Hello, {props.name}!</div>
}
```

No internal state, no isolated reactive boundary. Pure props-in / JSX-out.

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

// Usage
<Welcome title="Hello" count={count.value} />
```

## JSX & DOM Rendering

Actview uses a **custom JSX factory** (`createElement`) that creates real DOM nodes directly — no virtual DOM.

```tsx
// JSX → createElement → real DOM
const element = <div class="card">
  <h3>Title</h3>
  <p>Content</p>
</div>
```

### Reactive Updates (Component-Level)

```tsx
function Timer() {
  const time = ref(new Date().toLocaleTimeString())

  setInterval(() => {
    time.value = new Date().toLocaleTimeString()
  }, 1000)

  return () => <div>Current time: {time.value}</div>
}
```

- `time.value` changes → triggers `publish`
- Only this component's `componentUpdateFn` re-runs
- Compares old and new DOM nodes, patches only the changed parts

### Fragment

```tsx
function List() {
  return () => (
    <>
      <h2>Items</h2>
      {items.map(item => <div key={item.id}>{item.text}</div>)}
    </>
  )
}
```

Fragment wraps children in a `DocumentFragment` with start/end comment anchors for stable diffing.

### Keyed Reconciliation

Child nodes with a `key` prop are matched by identity, preserving DOM state (e.g., input focus):

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
        Shuffle
      </button>
    </>
  )
}
```

Without keys, shuffling would misplace input values. With keys, each input stays with its matching `div`.

## Slots

Named slots use `<template slot="xxx">` syntax. The template's content is extracted and passed as `props.xxx` to the component. Content not wrapped in `<template slot>` becomes `props.children` (default slot).

### Defining a Component with Slots

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

### Using Slots

```tsx
<Card>
  <template slot="header">
    <span>📌</span>
    <strong>Title</strong>
  </template>

  <p>Main body content — becomes props.children.</p>

  <template slot="footer">
    <span>Footer info</span>
  </template>
</Card>
```

How it works inside `createElement`:

1. Children passed to the component are iterated
2. Elements matching `child instanceof HTMLTemplateElement && child.getAttribute("slot")` have their content extracted into the named prop
3. Other children are collected into `props.children`

```ts
// Pseudocode of the slot resolution
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

## Router

Actview includes a client-side router with nested route support.

### Setup

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

### Navigation

```tsx
import { useRouter } from "@actview/router"

function NavBar() {
  const router = useRouter()

  return () => (
    <nav>
      <a onClick={() => router.push("/")}>Home</a>
      <a onClick={() => router.push("/about")}>About</a>
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
      <RouterView />  {/* renders matched route component */}
    </div>
  )
}
```

For nested routes, place `<RouterView />` inside the parent layout component — it automatically renders the child route at the current depth.

## Architecture

```
packages/
  core/         Reactivity (ref, reactive, computed, watch) + EventBus
  jsx/          Custom JSX factory (createElement, mountComponent, diffElement)
  router/       Client-side router with nested route support
  actview/      Package re-exports
```

### Diff Algorithm

`diffElement` compares two real DOM nodes directly (no virtual DOM):

1. **Type mismatch** → replace
2. **Text node** → update `textContent`
3. **Component boundary** → skip (component manages its own subtree)
4. **Same element** → sync attributes → reconcile children (keyed or index-based)

Component boundary isolation means a re-rendering parent does not diff into child components. Each component has its own `componentUpdateFn` that runs independently when its reactive dependencies change.

## License

MIT
