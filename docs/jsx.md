# JSX 运行时原理

## 概述

`@actview/jsx` 提供自定义 JSX 工厂函数，将 JSX 编译产物转换为真实 DOM 操作。核心包括：

- `createElement` / `jsx` / `jsxDEV` — JSX 工厂函数
- `mountComponent` — 函数组件挂载与响应式更新
- `diffElement` / `patchComponentFragment` — DOM diff 与 Fragment 更新
- `Fragment` — 多根节点支持

## 组件系统核心：mountComponent

### 设计目标

每个函数组件拥有**独立的更新函数** `componentUpdateFn`，实现组件级别的依赖收集和更新隔离。当组件的响应式数据变化时，只重新渲染该组件自身，不触发父级或兄弟组件。

### 两种组件写法

#### 1. Setup 模式（推荐）

组件函数执行一次「setup 阶段」，返回一个「render 函数」：

```typescript
function Home() {
  const list = reactive([...])  // setup 阶段，只执行一次
  return () => <div>...</div>   // render 函数，每次更新重新执行
}
```

- **setup 阶段**：创建 ref/reactive/computed/watch，只执行一次
- **render 阶段**：每次响应式数据变化时重新执行，生成新 DOM 并与旧 DOM diff

#### 详解：为什么 setup 只执行一次？

以计数器为例：

```typescript
function Counter() {
  // ═══════ Setup 阶段 ═══════
  const count = ref(0)              // (A) 创建 ref
  //          ↑ mountComponent 调用 tag(props) 时执行

  return () => {                     // (B) 返回 render 函数
    // ═══════ Render 阶段 ═══════
    return <div>{count.value}</div>  // (C) 每次更新执行
  }
}
```

**关键在 mountComponent 内部**：

```typescript
// mountComponent 简化逻辑
function mountComponent(tag, props) {
  // ▶ 1: 暂存父级更新函数
  const parentUpdateFn = getUpdateFn()
  setUpdateFn(componentUpdateFn)        // ← 设置组件自己的更新函数

  // ▶ 2: 执行 tag(props) —— 即 Counter() 的整体
  const setupResult = tag(props)
  //    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //    这一步 ⇒ Counter() 执行完毕 ⇒ count = ref(0) 创建
  //                              ⇒ 返回 () => <div>{count.value}</div>

  // ▶ 3: 判断是 setup 模式（返回了函数）
  if (typeof setupResult === 'function') {
    instance.renderFn = setupResult     // 保存 render 函数
    domResult = setupResult(props)       // ▶ 首次 render
    //          ^^^^^^^^^^^^^^^^^^^^^^^
    //          这一步 ⇒ 读取 count.value ⇒ 触发 Proxy.get
    //                   ⇒ subscribe(count, componentUpdateFn)
  }

  // ▶ 4: 恢复父级更新函数
  setUpdateFn(parentUpdateFn)
}
```

**当用户点击 +1 时**：

```typescript
// 1. count.value++ → Proxy.set → eventBus.publish(count)
//                     ↓
// 2. forEach 所有订阅者 → 找到了 componentUpdateFn
//                     ↓
// 3. componentUpdateFn 执行：
//
//    const componentUpdateFn = () => {
//      const newResult = instance.renderFn(instance.props)
//      //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//      //                只调用了 render 函数，即 return 后面的 () => ...
//      //                不会重新调用 Counter() 整体
//      //
//      //                renderFn 读取 count.value（新值）
//      //                → 生成新 DOM：<div>1</div>
//
//      diffElement(oldEl, newResult)   // 对比新旧 DOM，更新页面
//    }
```

**要点总结**：

| 阶段 | 执行时机 | 执行内容 | `currentUpdateFn` |
|------|---------|---------|-------------------|
| `tag(props)` | **mount 时 1 次** | `Counter()` 整体（含 `ref(0)`） | `componentUpdateFn` |
| `setupResult(props)` | mount 时 1 次 + **每次更新** | `() => <div>{count.value}</div>` | `componentUpdateFn` |
| `componentUpdateFn` | **每次数据变化** | 仅调用 `renderFn(props)` | 内部设为 `componentUpdateFn` |

`Counter()` 整体只执行一次，所以 `ref(0)` 只创建一次。`componentUpdateFn` 保存了 `renderFn`（即 `return () => ...` 的函数），数据变化时只调用它，不会回到 `Counter()` 顶部重新创建 ref。

#### 图解：内存与闭包

```typescript
// 第一次 mount 后的内存状态：
Counter 的 instance = {
  setupFn:  Counter,          // 原始组件函数
  renderFn: () => <div>...</div>,  // setup 返回的函数
  update:   componentUpdateFn,     // ← 闭包捕获了 instance
}

// componentUpdateFn 的闭包：
componentUpdateFn = () => {
  // 它只访问 instance 和 instance.renderFn
  // 它不知道也不关心 Counter() 函数本身
  // 所以它永远不会回到 Counter() 顶部
  const newResult = instance.renderFn(instance.props)
  //              ↑ 等价于直接执行 () => <div>{count.value}</div>
  //              不经过 Counter()
}
```

#### 2. 直接模式（兼容）

组件函数直接返回 DOM，没有内部状态，没有独立的更新路径：

```typescript
function Card(props) {
  return <div>{props.title}</div>  // 无状态组件，每次父级更新会重建
}
```

- 每次父组件 re-render 时，`mountComponent` 重新执行该函数
- DOM diff 时遇到直接模式的组件边界，会用新 props 重新执行组件函数并 diff 结果

### 执行流程

```
mountComponent(tag, props)
  │
  ├─ ① 创建 ComponentInstance
  │   { setupFn, renderFn, props, el, isFragment, update }
  │
  ├─ ② 创建 componentUpdateFn
  │   （组件级更新函数，捕获 instance 为闭包）
  │
  ├─ ③ 暂存父级的 currentUpdateFn
  │   const parentUpdateFn = getUpdateFn()
  │   setUpdateFn(componentUpdateFn)
  │   │
  │   ├─ ④ 执行组件函数（setup 阶段）
  │   │   const setupResult = tag(props)
  │   │   │
  │   │   ├─ 返回函数 = Setup 模式
  │   │   │   instance.renderFn = setupResult
  │   │   │   domResult = setupResult(props)  ← 执行 render，收集依赖
  │   │   │
  │   │   └─ 返回 DOM = 直接模式
  │   │       domResult = setupResult
  │   │
  │   ├─ ⑤ 恢复父级的 currentUpdateFn
  │   │   setUpdateFn(parentUpdateFn)
  │   │
  │   └─ ⑥ 在根 DOM 上标记 _componentInstance
  │        (Fragment 模式使用锚点注释节点)
  │
  └─ ⑦ 返回 DOM 树
```

### 依赖收集原理

```typescript
// ref 的 get 陷阱
get: (target, key) => {
  const currentUpdateFn = getCurrentUpdateFn()  // 当前活跃的更新函数
  if (key === "value" && currentUpdateFn) {
    eventBus.subscribe(state, currentUpdateFn)   // 订阅：数据变化时通知
  }
  return target.value
}
```

在 `mountComponent` 执行期间，`currentUpdateFn` 被设为该组件的 `componentUpdateFn`。组件函数执行过程中读取的所有 ref/reactive 数据，都会把 `componentUpdateFn` 注册为订阅者。

数据变化时：
```
ref.value = newValue
  → eventBus.publish(ref)
    → forEach 订阅者
      → componentUpdateFn（仅该组件）
        → renderFn(props) → 新 DOM 树
        → diffElement(旧根节点, 新根节点) → 更新 DOM
```

### 直接模式的 props 更新

直接模式组件没有独立的 render 函数。当父组件 re-render 遇到直接模式的组件边界时，diff 算法检测到 `setupFn === renderFn`（直接模式特征），会用新 props 重新执行组件函数并 diff：

```typescript
// diff.ts 组件边界路径
if (oldInstance.setupFn === oldInstance.renderFn) {
  const newDom = oldInstance.setupFn(oldInstance.props)  // 用新 props 重新执行
  return diff(oldNode, newDom as Node)                    // 与旧 DOM diff
}
```

## 组件挂载信息

### ComponentInstance

```typescript
interface ComponentInstance {
  setupFn: Function      // 原始组件函数
  renderFn: Function     // render 函数（setup 模式 ≠ setupFn，直接模式 = setupFn）
  props: Record<string, any>  // 最新 props
  el: Node | null        // 根 DOM 元素（Element 模式）或 startAnchor（Fragment 模式）
  isFragment: boolean    // 是否为 Fragment 模式
  update: () => void     // 组件级 updateFn
  _startAnchor?: Comment // Fragment 首锚点
  _endAnchor?: Comment   // Fragment 尾锚点
}
```

`_componentInstance` 挂载在组件根 DOM 元素的 `_componentInstance` 属性上，供 diff 算法识别组件边界。

## DOM Diff 策略

### 组件边界保护

> 注：以下为未注入 core diff 时的回退行为。当 `@actview/core` 注入 diff 后，实际使用 core 的统一实现。

diff 算法遇到组件根节点时，根据情况处理：

```
旧节点有 _componentInstance 且 新节点有 _componentInstance
  ├─ setupFn 不同 → replaceChild（路由切换等）
  ├─ 直接模式（setupFn === renderFn）→ 重新执行并 diff
  └─ Setup 模式 → 仅同步 props + 根属性，子节点由组件自身管理
```

### 子节点协调

- 有 `_key` 的子节点列表 → keyed reconciliation（按 key 匹配，保留状态）
- 无 key → index-based diff（按位置匹配）

### Fragment 更新

Fragment 组件（`<>...</>`）使用 `patchComponentFragment`，通过开头和结尾的注释锚点（`<!-- component-start -->` / `<!-- component-end -->`）追踪子节点范围，支持 keyed 和 index-based 两种 diff 策略。

## Fragment 组件

```typescript
export function Fragment(props: { children?: Child | Child[] }): DocumentFragment {
  const fragment = document.createDocumentFragment()
  // 追加子节点...
  return fragment
}
```

Fragment 使用 DocumentFragment 包裹多根节点。在 `mountComponent` 中被识别为 Fragment 模式，创建锚点追踪：

```
[parent DOM]
  ├─ <!-- component-start -->  (startAnchor / instance.el)
  ├─ 子节点 1
  ├─ 子节点 2
  ├─ ...
  └─ <!-- component-end -->    (endAnchor)
```

更新时，`patchComponentFragment` 收集两个锚点之间的旧子节点，与新的 Fragment 子节点做 reconciliation。
