# DESIGN — actview 设计文档：响应式系统与 JSX 的连接

> 本文说明本项目如何把「响应式数据」与「JSX 组件」连接起来，
> 实现 `组件 => 虚拟DOM => DIFF => 真实DOM` 的完整渲染与更新链路。

---

## 1. 总览

整个框架分三层，从源码到屏幕依次经过：

```
┌─────────────────────────── 编译期（构建时，一次） ───────────────────────────┐
│  .tsx 源码                                                                   │
│    function App() { return <div>{count}</div> }                              │
│      │ ① actview Babel 插件                                                  │
│      ▼                                                                       │
│    const App = defineComponent(function() { return () => <div>{count}</div> })│
│      │ ② esbuild JSX 自动转换（jsxImportSource 指向 @local/jsx-factory）      │
│      ▼                                                                       │
│    const App = defineComponent(function() {                                  │
│      return () => jsx('div', { children: count })                            │
│    })                                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────── 运行期（浏览器中，持续） ─────────────────────────┐
│  createApp(App).mount('#app')                                                │
│    mountComponent ── 建立「组件实例 + 响应式 effect」                          │
│      runEffect(() => {                                                       │
│        const newVnode  = render()     // 组件 =》 虚拟DOM（读响应式数据→收集依赖）│
│        patch(oldVnode, newVnode)      // 虚拟DOM =》 DIFF =》 真实DOM          │
│      })                                                                      │
│      数据一变 → trigger → effect 自动重跑 → 上述两步再次执行                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**核心思想一句话**：组件就是「响应式 effect 包裹的一个 `render()` 函数」——`render()` 负责把响应式数据读出来生成 VNode，effect 负责在数据变化时自动重跑 `render + patch`。响应式系统管「何时重跑」，diff 管「怎么最小化更新 DOM」。

---

## 2. 模块划分

```
packages/jsx/src/           @local/jsx-factory    JSX 层
  jsxFactory.ts               jsx/jsxs/jsxDEV/createElement → VNode
  types.ts                    VNode / 属性 / 事件类型
  global.ts                   JSX.IntrinsicElements 全局类型增强

packages/core/src/          @local/core           运行时
  reactivity/reactive.ts       reactive()：Proxy 拦截 get/set/deleteProperty
  runtime/reactive-system.ts   ReactiveEffect / track / trigger / runEffect
  runtime/component.ts         defineComponent(setup) → { __setup }
  runtime/mountComponent.ts    组件实例化，连接响应式与渲染（核心连接点）
  runtime/renderer.ts          patch / mount / unmount（DIFF 引擎）
  runtime/createApp.ts         createApp().mount('#app')

plugins/babel-plugin-actview/src/   @actview/babel-plugin-actview  编译期
  babel-plugin.ts              function 组件 → defineComponent 转换
plugins/plugin-vite/src/       @actview/plugin-vite            Vite 适配
  vite-plugin.ts               enforce:'pre' 的 transform，接入 Babel
```

---

## 3. 编译期：JSX 变成什么

### 3.1 Babel 插件（`babel-plugin.ts`）

为了让组件拥有 Vue 风格的「setup + render」二分结构，Babel 插件把首字母大写的函数组件改写：

```js
function App() {                       //  const App = defineComponent(function() {
  return <div>...</div>                //    return () => <div>...</div>
}                                      //  })
```

要点：

- 只转换「最后一个语句是 `return <JSX>`」的大写函数，其余函数不碰；
- `return JSX` 包成箭头函数 `return () => JSX` —— **render 被惰性化**，只有真正渲染时才执行，且每次渲染都是「读响应式数据」的时机；
- 自动注入 `import { defineComponent } from '@local/core'`。

### 3.2 JSX 自动转换（`jsxFactory.ts`）

`tsconfig.json` 里：

```json
"jsx": "react-jsx",
"jsxImportSource": "@local/jsx-factory"
```

让 TypeScript/esbuild 的 automatic JSX transform 把 `<div a="1">x</div>` 编译成对 `@local/jsx-factory` 的 `jsx('div', {...})` 调用。`jsxImpl` 统一逻辑：

```js
function jsxImpl(type, config, maybeKey) {
  // 从 config 中分离 key
  return { $$typeof: Symbol.for('react.element'), type, key, ref: null, props }
}
```

产物就是 **VNode**：`type` 是标签字符串 / `Fragment` symbol / 组件对象，`props` 是属性与 children，`el` 字段留待挂载后指向真实 DOM。

---

## 4. 运行期：三个基础件

### 4.1 响应式系统（`reactive.ts` + `reactive-system.ts`）

- `reactive(obj)`：Proxy 包装，`get → track(target, key)`，`set` / `deleteProperty` → `trigger(target, key)`。
- 依赖表：`targetMap: WeakMap<object, Map<key, Set<ReactiveEffect>>>`。
- `ReactiveEffect`：`run()` 先 `cleanupEffect`（清掉旧依赖，避免过期依赖），置 `activeEffect` 后执行 `fn`，再恢复上一个 effect（支持嵌套）。
- `runEffect(fn)`：创建 effect 并立即执行一次。

这就是 Vue 3 的 effect 模型。**它只回答一个问题：谁在读数据？数据变了叫谁？**

### 4.2 VNode

`type` 决定 diff 策略，`key` 决定列表复用，`el` 是「虚拟 DOM 与真实 DOM 之间的桥」——patch 时通过 `el` 复用真实节点，只改属性/children 而不是重建。

### 4.3 DIFF 引擎（`renderer.ts`）

`patch(oldVnode, newVnode, container, index?)` 是唯一入口，按四种情况分派：

| 情况 | 策略 |
|---|---|
| `oldVnode == null` | 挂载：`mountVNode` 创建 DOM 并 append |
| `newVnode == null` | 卸载：`unmount` |
| `type` 与 `key` 都相同 | 更新：`patchVNode` 复用 `el`，递归 diff props/children |
| 其余 | 替换：`replace` 用 `replaceChild` 换节点 |

`patchVNode` 内按 `type` 分派四种节点：组件（`{ __setup }` 对象）、文本（内部 `Text` symbol）、`Fragment`、原生元素。

---

## 5. 核心连接点：`mountComponent`（组件 =》 虚拟DOM）

这是「响应式系统 ↔ JSX」连接的关键代码（`mountComponent.ts`）：

```ts
// ① 组件对象是 defineComponent 产物：{ __setup }
const props = { ...(vnode.props || {}) }          // 普通对象，见 §7
const instance = {
  props,
  render: options.__setup(props),                 // ② setup 只执行一次，返回 render
  subTree: null,
  update: () => {},
  unmount: () => {},
}

// ③ 更新函数：render 生成新 VNode 树，与旧树 diff
const update = () => {
  const newSubTree = instance.render()            // 读响应式数据 → 收集本 effect
  const oldSubTree = instance.subTree
  instance.subTree = newSubTree
  patch(oldSubTree, newSubTree, container)        // diff → 真实 DOM
  vnode.el = instance.subTree.el                  // 刷新组件根 el
}

// ④ 连接点：effect 包住 render + patch
const effect = runEffect(update)                  // 立即跑一次（首屏挂载）
```

**这就是全框架最重要的一行**：`runEffect(update)`。

- `update` 里 `render()` 读取 `reactive` 数据 → Proxy `get` → `track` 把**当前 effect**（即这个组件的 effect）记入依赖；
- 之后任何地方修改该数据 → Proxy `set` → `trigger` → 该 effect 重跑 → `update` 再次执行 → 新 VNode 树 + patch。

于是「组件内部状态变化 → 自动更新」不需要任何手动订阅：**数据流闭环由 effect 隐式完成**。每个组件一个 effect，嵌套组件各有各的 effect，互不干扰。

`vnode.el` 指向组件子树根节点，使得组件节点可以像元素节点一样被父级 diff 复用/替换。

---

## 6. 更新过程全链路（时序）

以 Counter 点 `+1` 为例：

```
1. 用户点击 → onclick handler → state.count++
2. Proxy set 陷阱：oldValue(1) !== value(2) → trigger(target, 'count')
3. targetMap 命中初次挂载时收集的 dep（render 读过 state.count → effect 在 dep 里）
4. effect.run()：cleanup 旧依赖 → activeEffect = 本组件 effect → update()
5. update()：
   a. render() 生成新 VNode 树（读 count=2，并重新收集依赖）
   b. patch(oldSubTree, newSubTree, container)
        ├─ 根元素 type/key 相同 → patchVNode：复用 el
        │    ├─ patchProps：无属性变化，跳过
        │    └─ patchChildren：递归 diff
        │         └─ 文本子节点变化 → 更新 textContent
        │         └─ input 的 value 属性变化 → el.value = 2
        └─ vnode.el 刷新
6. DOM 更新完成，浏览器重绘
```

**为什么这里不需要「虚拟 DOM 对比整棵旧树」**？因为 diff 是逐层递归的：每一层只对比同索引（或同 key）的节点，`type` 不同直接整棵替换，相同则继续往下。复杂度由树深决定，与全局状态无关。

---

## 7. props 更新链路（父 =》 子）

子组件更新由**父组件显式调度**（`renderer.ts` 的 `patchComponent`）：

```
父组件 state 变化
  → 父 effect 重跑 → 父 render() 生成新树（子组件 vnode 带新 props）
  → patch 走到子组件 vnode
  → patchComponent：
       isSameProps(旧 props, 新 props)？
         ├─ 相同 → 复用 instance，什么都不做
         └─ 不同 → updateProps(instance.props, 新 props)  // 增量写入
                    └─ 若有变化 → instance.update()       // 手动触发子组件 effect
  → 子 update：子 render()（读到新 props）→ 子 patch → 子 DOM 精确更新
```

**`setup` 在整个生命周期只执行一次**：props 更新走 `update()` 而不是重新 `mountComponent`，所以子组件的内部状态、DOM 节点全部复用。这就是「props 细粒度更新」的实现。

### 为什么 props 用普通对象而不是 reactive？（重要设计决策）

第一版 props 用 `reactive` 包装，期望「父改 props → 子自动更新」。但踩到一个严重的 effect 递归问题：

1. `patchComponent` 里 `Object.is(instance.props[key], newProps[key])` 读取 `instance.props` 时，`activeEffect` 是**父 effect** → 父 effect 被误收集进子 props 的依赖；
2. 写 `instance.props[key] = 新值` 时 `trigger` 出依赖里的**父 effect** → 父 effect 递归重入；
3. 重入发生时 `newVnode.component` 还没赋值 → 重入的 patch 找不到旧实例 → 子组件被莫名重挂，`setup` 执行两次。

修复：**props 用普通对象，父组件更新 props 后显式调用 `instance.update()`**。这也是 Vue 的做法——props 更新由父组件调度，不依赖响应式自动传播。显式调度避免了「读 props 污染父 effect 依赖」这一整类问题。

---

## 8. diff 细节

### 8.1 文本节点：为什么用 `childNodes[index]`

每次 `render()` 都生成全新 VNode 树，children 里的**字符串子节点**没有持久对象，`toVNode` 临时包装出来的文本 VNode 会在下一轮 diff 时丢失 `el`。因此文本更新不依赖 `el`，而是按索引从 `container.childNodes[index]` 恢复真实文本节点（Vue 的做法）。`unmount` 同样支持按索引兜底。

### 8.2 keyed diff（`patchKeyedChildren`）

新列表出现 `key` 时启用（否则退回同索引 diff）：

```
1. 建旧 key → index 映射
2. 遍历新列表：key 命中 → patch 复用（更新 el 指向）
                 未命中 → 先创建（不挂载）
3. 卸载未复用的旧节点（此时 DOM 仍是旧顺序，文本可按索引恢复）
4. 按新顺序依次 appendChild 重排（appendChild 对已挂载节点是"移动"，真实 DOM 语义）
```

重排依赖一个关键事实：`appendChild` 已挂载节点 = 移动节点。所以「先 patch 复用，再整体按新顺序 append」就能以最少操作完成增删重排，且**组件节点同样适用**（复用旧实例，只改位置）。

### 8.3 属性更新（`patchProps` / `setProp`）

- `on*` → 直接绑定到 `el.on*`（删除时置 `null` 解绑）；
- `class/className`、`value`、`checked`、`style` → 走 property；
- `data-*` 等其余 → `setAttribute` / `removeAttribute`；
- 旧 props 中存在、新 props 中没有的 key → 删除。

---

## 9. 已知限制与后续方向

| 限制 | 原因 | 后续 |
|---|---|---|
| `items.push()` 不触发更新 | `reactive` 只拦截 `get/set/deleteProperty`，数组方法走内部索引/length，而 `render` 只 track 了 `items` 这个 key | 给数组方法做 instrumentation（Vue 3 做法），或 `state.items = [...state.items, x]` |
| 同索引 diff 不做最小移动 | 无 key 列表按位置对比 | 无 key 场景本身不需要移动 |
| 事件无独立解绑/捕获阶段 | `el.on*` 直接赋值 | 需要时引入 `addEventListener` 管理 |
| keyed diff 是「复用 + 整体重排」，非 LIS 最小移动 | 教学取舍，O(n) 重排对小型列表足够 | 可替换为最长递增子序列（LIS）方案 |

---

## 10. 文件索引（按阅读顺序）

1. `packages/jsx/src/jsxFactory.ts` — JSX → VNode
2. `plugins/babel-plugin-actview/src/babel-plugin.ts` — 组件编译转换
3. `packages/core/src/reactivity/reactive.ts` — Proxy 响应式
4. `packages/core/src/runtime/reactive-system.ts` — effect/track/trigger
5. `packages/core/src/runtime/component.ts` — defineComponent
6. `packages/core/src/runtime/mountComponent.ts` — **响应式与渲染的连接点**
7. `packages/core/src/runtime/renderer.ts` — patch / diff / mount / unmount
8. `packages/core/src/runtime/createApp.ts` — 应用入口
9. `src/main.tsx` — 功能检验页
10. `scripts/verify.mjs` + `scripts/verify-entry.tsx` — DOM stub 下的端到端回归验证
