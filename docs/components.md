# 内置组件参考

> ActView 提供一系列内置组件，覆盖过渡动画、DOM 传送、缓存、错误处理、异步加载等场景。全部从 `'actview'` 直接导入。

---

## 目录

1. [Transition — 单子节点过渡动画](#1-transition--单子节点过渡动画)
2. [TransitionGroup — 列表过渡动画](#2-transitiongroup--列表过渡动画)
3. [Teleport — DOM 传送门](#3-teleport--dom-传送门)
4. [KeepAlive — 组件实例缓存](#4-keepalive--组件实例缓存)
5. [ErrorBoundary — 渲染错误边界](#5-errorboundary--渲染错误边界)
6. [Suspense — 异步加载占位](#6-suspense--异步加载占位)
7. [lazy — 异步组件工厂](#7-lazy--异步组件工厂)
8. [Fragment — 多根节点片段](#8-fragment--多根节点片段)
9. [component — 动态组件](#9-component--动态组件)
10. [注意与常见误区](#10-注意与常见误区)

---

## 1. Transition — 单子节点过渡动画

### 作用

为单个子节点的**挂载和卸载**添加进入/离开动画。与 Vue 3 `<Transition>` 设计一致。

### 导入

```tsx
import { Transition } from 'actview'
// 或直接在 JSX 中使用：<Transition>...</Transition>
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | `'v'` | CSS 过渡类名前缀。例如 `name="fade"` → 类 `fade-enter-from`、`fade-leave-active` 等 |
| `mode` | `'out-in'` | — | 过渡模式。`out-in`: 旧节点离开动画完成后新节点再进入（避免两个节点同时存在） |
| `appear` | `boolean` | `false` | 是否在首次挂载时也播放进入动画（默认不播，对齐 Vue） |
| `duration` | `number` | — | 过渡时长（ms）。不传时自动读取 CSS `transitionDuration`；传了则作为兜底超时 |
| `onBeforeEnter` | `(el) => void` | — | JS 钩子：进入前 |
| `onEnter` | `(el, done) => void` | — | JS 钩子：进入中。收到 `done` 回调，完成后需手动调用 `done()` |
| `onAfterEnter` | `(el) => void` | — | JS 钩子：进入后 |
| `onBeforeLeave` | `(el) => void` | — | JS 钩子：离开前 |
| `onLeave` | `(el, done) => void` | — | JS 钩子：离开中。完成后需手动调用 `done()` |
| `onAfterLeave` | `(el) => void` | — | JS 钩子：离开后 |

### 基本使用（CSS 类）

```tsx
// CSS
.fade-enter-from { opacity: 0; }
.fade-enter-active { transition: opacity .3s; }
.fade-enter-to   { opacity: 1; }
.fade-leave-from { opacity: 1; }
.fade-leave-active { transition: opacity .3s; }
.fade-leave-to   { opacity: 0; }

// JSX
function App() {
  const show = ref(true)
  return (
    <>
      <button onClick={() => show.value = !show.value}>toggle</button>
      <Transition name="fade">
        {show.value ? <div>内容</div> : null}
      </Transition>
    </>
  )
}
```

#### 类名规则

| CSS 类 | 添加时机 | 移除时机 |
|--------|----------|----------|
| `{name}-enter-from` | 元素插入时立刻添加 | 下一个 rAF（双 rAF 后） |
| `{name}-enter-active` | 元素插入时立刻添加 | 动画结束后 |
| `{name}-enter-to` | 移除 `enter-from` 后添加 | 动画结束后 |
| `{name}-leave-from` | 离开开始时添加 | 下一个 rAF（双 rAF 后） |
| `{name}-leave-active` | 离开开始时添加 | 动画结束后 |
| `{name}-leave-to` | 移除 `leave-from` 后添加 | 动画结束后 |

### mode="out-in" — 先离后入

当新旧节点同时存在可能造成视觉跳跃时使用：

```tsx
<Transition name="fade" mode="out-in">
  {view.value === 'a' ? <CompA /> : <CompB />}
</Transition>
```

### JS 钩子模式（替代 CSS）

如果不想用 CSS 类，完全用 JS 控制动画：

```tsx
<Transition
  onEnter={(el, done) => {
    el.style.opacity = '0'
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
      .onfinish = () => { el.style.opacity = ''; done() }
  }}
  onLeave={(el, done) => {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 })
      .onfinish = done
  }}
>
  {show.value ? <div>内容</div> : null}
</Transition>
```

> 提供 JS 钩子后，CSS 类模式不再生效。

### 注意

- Transition **只支持单子节点**。多子节点时取第一个，其余忽略（console.warn）
- 子节点必须是**同位置切换**（同一 `<Transition>` 内的条件渲染），不是新增或移除兄弟节点
- `appear` 默认不播进入动画（对齐 Vue 语义）。需要首次播放时显式设置

---

## 2. TransitionGroup — 列表过渡动画

### 作用

为列表（`v-for` / `map`）中项的**插入、移除、移动**添加过渡动画。与 Vue 3 `<TransitionGroup>` 设计一致。

### 导入

```tsx
import { TransitionGroup } from 'actview'
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `string` | `'v'` | CSS 过渡类名前缀（与 Transition 同规则） |
| `tag` | — | — | **暂不支持**。当前始终返回 Fragment（无包裹元素） |

### 基本使用

```tsx
// CSS
.list-enter-from { opacity: 0; transform: translateX(-20px); }
.list-enter-active { transition: all .3s; }
.list-leave-from { opacity: 1; }
.list-leave-active { transition: all .3s; position: absolute; }
.list-leave-to   { opacity: 0; transform: translateX(20px); }

// JSX
function List() {
  const items = ref([{ id: 1, text: 'a' }, { id: 2, text: 'b' }])
  return (
    <TransitionGroup name="list">
      {items.value.map(item => (
        <div key={item.id}>{item.text}</div>
      ))}
    </TransitionGroup>
  )
}
```

### 注意

- **每个项必须有 `key`**，否则无法追踪增删移动
- 列表项删除时播 leave 动画→动画完成后才真正从 DOM 移除
- 当前不包裹额外标签（无 `tag` 支持），直接以 `<>...</>`（Fragment）渲染

---

## 3. Teleport — DOM 传送门

### 作用

将 children 渲染到当前组件树之外的指定 DOM 容器中（与 React `createPortal` / Vue 3 `<Teleport>` 一致）。

### 导入

```tsx
import { Teleport } from 'actview'
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `to` | `string \| Element \| null` | — | CSS 选择器或 DOM 元素。字符串时内部调用 `document.querySelector`；`null` 时内联（等价不传送） |

### 基本使用

```tsx
<Teleport to="#modal-root">
  <div class="modal">弹窗内容</div>
</Teleport>
```

### 动态目标

```tsx
const target = ref('#modal-a')

// to 变化时自动迁移 DOM
<Teleport to={target.value}>
  <div>...</div>
</Teleport>
```

### 注意

- `to` 选择器对应的元素必须在 Teleport 挂载前已存在于 DOM 中
- 目标不存在时跳过渲染并 console.warn
- `to` 变化时 DOM 会从旧目标迁移到新目标（不是重新挂载），子组件实例和状态保持

---

## 4. KeepAlive — 组件实例缓存

### 作用

缓存动态切换的组件实例和 DOM，避免重复销毁和创建。与 Vue 3 `<KeepAlive>` 一致。

### 导入

```tsx
import { KeepAlive } from 'actview'
```

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `include` | `string \| RegExp \| string[]` | 只缓存匹配的组件（组件名匹配） |
| `exclude` | `string \| RegExp \| string[]` | 不缓存匹配的组件 |
| `max` | `number` | 最大缓存实例数。超限时 LRU 淘汰 |

### 基本使用

```tsx
<KeepAlive>
  <component is={currentView.value} />
</KeepAlive>
```

#### include / exclude

组件名匹配规则（与 Vue 3 一致）：

- 数组：逐项匹配
- 正则：`.test(name)`
- 逗号分隔字符串：`.split(',').map(s => s.trim())`

ActView 的组件名来源：

- `defineComponent(fn, name)` 第二个参数
- 函数/变量名（Babel 插件自动传递）

```tsx
<KeepAlive include="Editor,Preview">
  <component is={currentView.value} />
</KeepAlive>
```

#### max + LRU

```tsx
<KeepAlive max={5}>
  <component is={currentView.value} />
</KeepAlive>
```

超过 5 个缓存时，**最久未激活**的实例被销毁。

### 生命周期钩子

被 `<KeepAlive>` 缓存的组件在激活/失活时触发额外钩子：

```tsx
function CachedComp() {
  onActivated(() => {
    // 组件从缓存重新激活（DOM 移回视口）
    console.log('activated')
  })
  onDeactivated(() => {
    // 组件被移入缓存（DOM 隐藏到占位容器）
    console.log('deactivated')
  })
  return <div>...</div>
}
```

`onMounted` / `onUnmounted` **不会**在缓存切换时重复触发（只触发一次：首次挂载和最终销毁）。

### 注意

- 子组件必须是**单根元素**（不支持 Fragment / 多根节点）
- 子组件必须有稳定的 `key`。不传 `key` 时默认以组件名/类型作为 key
- `include`/`exclude` 匹配失败时，该组件正常挂载卸载（不走缓存）
- KeepAlive 自身卸载时清空全部缓存并销毁所有缓存的实例

---

## 5. ErrorBoundary — 渲染错误边界

### 作用

捕获子树渲染过程中的错误，显示 fallback UI，防止整个应用白屏。与 React `ErrorBoundary` 一致。

### 导入

```tsx
import { ErrorBoundary } from 'actview'
```

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `fallback` | `VNode \| ((error: any) => VNode)` | 错误时显示的内容。可以是静态 JSX 或接收错误对象的函数 |

### 基本使用

```tsx
<ErrorBoundary fallback={<div>出错了</div>}>
  <MaybeCrashComp />
</ErrorBoundary>
```

### 函数式 fallback（接收错误对象）

```tsx
<ErrorBoundary fallback={(err) => (
  <div class="error-panel">
    <h2>渲染错误</h2>
    <pre>{err.message}</pre>
  </div>
)}>
  <MaybeCrashComp />
</ErrorBoundary>
```

### 嵌套边界

ErrorBoundary 支持嵌套：内层边界捕获后显示自己的 fallback，错误不会再冒泡到外层。

### 注意

- ErrorBoundary 捕获的是子组件**渲染**（render）过程中的同步错误，以及 **lazy 组件加载失败**的异步错误
- 不捕获事件处理函数中的错误（那些应自行 try/catch）
- 已有错误状态的边界不会重复触发（防止 fallback 也抛错导致死循环）
- 没有 ErrorBoundary 时渲染错误通过 `console.error` 输出

---

## 6. Suspense — 异步加载占位

### 作用

在异步组件（`lazy`）加载完成前显示 fallback 内容。与 Vue 3 `<Suspense>` 一致。

### 导入

```tsx
import { Suspense, lazy } from 'actview'
```

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `fallback` | `VNode` | 加载未完成时显示的内容 |

### 基本使用

```tsx
const HeavyComp = lazy(() => import('./HeavyComp'))

function App() {
  return (
    <Suspense fallback={<div class="spinner">loading...</div>}>
      <HeavyComp />
    </Suspense>
  )
}
```

### 嵌套 Suspense

Suspense 支持嵌套。内层未完成时显示自己最近的 `fallback`，不影响外层已渲染的部分：

```tsx
<Suspense fallback={<div>整体加载中...</div>}>
  <Header />
  <Suspense fallback={<div>内容加载中...</div>}>
    <LazyContent />
  </Suspense>
  <Footer />
</Suspense>
```

### 注意

- Suspense 的内部机制：加载中时子组件渲染为 `display:none`（保留 DOM 占位），fallback 叠加显示。加载完成后 fallback 消失，子组件 `display:''` 正常显示——**不会卸载重挂**子组件
- 只有 `lazy` 包裹的组件会向 Suspense 注册。普通同步组件在 Suspense 内直接渲染
- Suspense 没有 `timeout` 或 `onResolve` 等 Vue 3 扩展属性（当前保持最小实现）

---

## 7. lazy — 异步组件工厂

### 作用

包装动态 `import()` 返回一个可被 `<Suspense>` 感知的异步组件。与 Vue 3 `defineAsyncComponent` / React `lazy` 一致。

### 导入

```tsx
import { lazy, Suspense } from 'actview'
```

### 基本使用

```tsx
// 包装动态 import（默认导出或命名导出均可）
const ProfilePage = lazy(() => import('./ProfilePage'))

// 包装命名导出组件
const { AdminPanel } = lazy(() => import('./admin').then(m => ({ default: m.AdminPanel })))
```

### 配合 Suspense

见 [Suspense 章节](#6-suspense--异步加载占位)。

### 注意

- loader 返回的 Promise resolve 后取 `m.default ?? m` 作为组件
- lazy 组件在加载完成前渲染 `null`（占位），Suspense 据此切换 fallback
- 加载失败时抛错，可由外层 ErrorBoundary 捕获
- **不在 Suspense 内时**：lazy 组件加载完成后立即渲染，加载期间渲染 `null`（没有 fallback）

---

## 8. Fragment — 多根节点片段

### 作用

包裹多个并列的子节点而不产生额外 DOM 元素。与 React `Fragment` / Vue 3 `<template>` 多根节点一致。

### 使用方式

```tsx
// 简写（Babel 插件转换）
<>
  <div>第一项</div>
  <div>第二项</div>
</>

// 显式导入
import { Fragment } from 'actview'
<Fragment>
  <div>第一项</div>
  <div>第二项</div>
</Fragment>
```

### 注意

- Fragment 不产生 DOM 节点，children 直接在其父容器中并列渲染
- 与 KeepAlive 不兼容（KeepAlive 要求单根元素子节点）

---

## 9. component — 动态组件

### 作用

通过 `is` prop 动态切换渲染的组件。与 Vue 3 `<component :is>` 一致。

### 导入

无需导入——编译期 `<component is={...}>` 被识别为内置组件。

### 基本使用

```tsx
const view = ref<'login' | 'register'>('login')

// 按字符串选择组件（组件必须先注册/导入）
import { LoginForm, RegisterForm } from './forms'

function App() {
  return (
    <component is={view.value === 'login' ? LoginForm : RegisterForm} />
  )
}
```

### 配合 KeepAlive

```tsx
<KeepAlive>
  <component is={currentTab.value} />
</KeepAlive>
```

### 注意

- `is` 可以是组件对象、组件函数或字符串（字符串时从当前上下文解析——与 Vue 3 字符串模板不同，ActView 中字符串 `is` 不自动注入全局组件，建议直接传组件引用）
- 切换时默认卸载旧组件、挂载新组件。需要保持状态时在外层加 `<KeepAlive>`

---

## 10. 注意与常见误区

### 10.1 Transition 只支持单子节点

```tsx
// ❌ 多个子节点：只有第一个生效
<Transition name="fade">
  <div>A</div>
  <div>B</div>
</Transition>

// ✅ 需要列表过渡用 TransitionGroup
<TransitionGroup name="fade">
  <div key="a">A</div>
  <div key="b">B</div>
</TransitionGroup>
```

### 10.2 KeepAlive 子节点必须是单根元素

```tsx
// ❌ Fragment 子节点——KeepAlive 无法缓存
<KeepAlive>
  <>
    <div>A</div>
    <div>B</div>
  </>
</KeepAlive>

// ✅ 单根元素
<KeepAlive>
  <div class="panel">
    <div>A</div>
    <div>B</div>
  </div>
</KeepAlive>
```

### 10.3 Transition 子节点切换必须是同一位置的条件渲染

```tsx
// ✅ 正确：同一 <Transition> 内条件切换
<Transition name="fade">
  {show.value ? <CompA key="a" /> : <CompB key="b" />}
</Transition>

// ❌ 错误：增加/移除子节点不触发过渡动画
<Transition name="fade">
  {items.value.map(item => <div key={item.id}>{item.text}</div>)}
</Transition>
// ↑ 应使用 TransitionGroup
```

### 10.4 Teleport 目标元素需提前存在

```tsx
// ❌ #modal 不存在时跳过渲染（console.warn）
<Teleport to="#modal">
  <div>弹窗</div>
</Teleport>

// ✅ 确保容器已存在
<body>
  <div id="modal"></div>
</body>
```

### 10.5 ErrorBoundary 不捕获事件中的错误

```tsx
function BadComp() {
  const handleClick = () => {
    throw new Error('click error')  // ❌ ErrorBoundary 不捕获
  }
  return <button onClick={handleClick}>click</button>
}

// 事件错误自行 try/catch
const handleClick = () => {
  try { riskyOp() } catch (e) { console.error(e) }
}
```

### 10.6 lazy 加载的组件需在 Suspense 内才有 fallback

```tsx
// ❌ 不在 Suspense 内——加载期间渲染 null，无 fallback
<LazyComp />

// ✅ 在 Suspense 内——加载期间显示 fallback
<Suspense fallback={<div>loading...</div>}>
  <LazyComp />
</Suspense>
```

---

> 组件完整 API 清单见 `docs/API.md`。React 与 Vue 3 的迁移对照分别见 `docs/react-migration.md` 与 `docs/vue-migration.md`。