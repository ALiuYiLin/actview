# Bugs 与已知限制

> 记录 PLAN.md 中尚未修复的问题 + 开发中确认的实际行为。
> 状态标记：🐛 未修复 bug ｜⚠️ 已知限制（设计取舍，非 bug）
> 所有条目均含复现与修复方向，便于排期。

---

## 一、未修复 Bug（🐛）

### 1. ✅ 已修复 — P0 `effect` 内修改数组爆栈（提交 c7e6c6e，verify 场景 17）

- **原问题**（已实测 `RangeError: Maximum call stack size exceeded`）：

  ```ts
  const state = reactive({ items: [1] })
  runEffect(() => {
    state.items.push(state.items.length) // effect 内修改自身依赖的数组
  })
  ```

- **原因**：数组 `push` 经代理 `set` 触发 `trigger` → 同步执行依赖它的 effect（`effect.run()`）→ 重跑时又 `push` → 无限同步递归。
- **修复**（`packages/core/src/runtime/reactive-system.ts` + `reactivity/reactive.ts`）：
  1. `pauseTracking() / resetTracking()`：数组修改方法（`push/pop/shift/unshift/splice/sort/reverse`）执行期间暂停依赖收集。
  2. `ReactiveEffect.run()` 重入保护（`_running` 标记）：effect 执行中再次被 trigger 直接跳过，不再同步递归。
  3. `run()` 内恢复 `shouldTrack`：effect 重跑是独立执行上下文，暂停期间嵌套触发的 effect 也能正常重新收集依赖。
- **验证**（verify 场景 17）：effect 内 push 不爆栈、恰好执行一次；其他依赖该数组的 effect 正常触发；组件渲染内 push 不崩。
- **遗留**：异步队列场景（组件 effect 内 push）仍有无限循环（与 Vue 3 相同），属「effect 内修改自身依赖」反模式，文档约束。

---

### 2. ✅ 已修复 — P1 同索引 diff 文本定位（本次提交，verify 场景 18）

- **原问题**：无 key 列表按位置对比，文本 vnode 的 `el` 未跨 diff 持久化，patch 时退化用 `container.childNodes[index]` 猜测——纯文本/混排列表增删中间项会错位（取到错误节点）。
- **修复**（`renderer.ts`）：vnode 级 children 缓存——`patchChildren` 接收旧 vnode（`oldVnode.__avChildren`，上次 diff 产生的带 `el` 的 vnode 列表），返回新列表存到新 vnode；文本节点跨 diff 精确定位，不再依赖 `childNodes[index]`。
- **验证**（verify 场景 18）：纯文本数组增删中间项显示与节点数正确；无 key 元素列表保持标准索引语义（文本正确、DOM 按索引复用）。
- **遗留**：无 key 元素列表增删中间项时 DOM 节点状态跟随索引（React/Vue 均如此），需配合 key；文本显示不受影响。

---

### 3. ✅ 已修复 — P2 Fragment 内文本索引偏移（本次提交，verify 场景 18）

- **原问题**：Fragment 位于兄弟节点中间时，其内部文本更新按 0 起始索引从容器 `childNodes` 恢复，取到兄弟节点造成错位（实测 `<span>A</span><>{[n, 'B']}</><span>C</span>` 更新 n 后变 `99BBC`，`spanA` 被误改）。
- **修复**：同 Bug 2 根因（文本 vnode el 丢失），vnode 级 children 缓存修复后 Fragment 文本精确定位（实测 `A99BC`，`spanA` 不被误改）。
- **验证**：verify 场景 18。  ```tsx
  // <div><span>A</span><>{state.n}</><span>B</span></div>
  // Fragment 内文本按 childNodes[0] 定位 → 拿到 <span>A</span> 而非 Fragment 的文本
  ```

- **原因**：`patchVNode` 文本分支 `container.childNodes[index]` 的 `index` 在 Fragment 内从 0 计数，与容器全局索引不一致。
- **修复方向**：Fragment patch 时携带正确的容器全局索引偏移，或文本 VNode 缓存真实 `el`（首次挂载后存 `vnode.el`，更新时直接复用而不按索引查）。

---

### 4. ✅ 已修复 — P3 空文本节点残留（本次提交，verify 场景 19）

- **原问题**（已实测）：子节点文本从有值变为 `''` 时，DOM 中残留空文本节点（`childNodes` 数量不变，`textContent` 为空）。
- **修复**（`renderer.ts`）：
  - 挂载空文本（`''`）不创建节点（`vnode.el = null`）
  - patch 到空文本时移除旧节点并置 `el = null`
  - 从空文本恢复非空时创建节点并插入到 `childNodes[index]` 锚点前（列表中间位置正确）
- **验证**（verify 场景 19）：置空后 `childNodes` 归 0、恢复后重建、首挂空不建节点、列表中间空文本增删不错位。
- **遗留**：多个连续空文本 + 后续节点同时恢复的边缘场景可能轻微错位（P3 小瑕疵，可接受）。

---

## 二、已知限制（⚠️ 设计取舍）

| 限制 | 说明 | 缓解/替代 |
|---|---|---|
| 无 key 列表 DOM 状态错位 | 无 key 元素列表增删中间项时 DOM 节点状态跟随索引（标准无 key 语义，文本显示正确） | 列表渲染务必加 `key` |
| `keep-alive` 子组件需单根元素 | Fragment 子组件 `subTree.el` 为 null，缓存/恢复无效 | 子组件返回单根元素 |
| `mounted` 顺序 | **子先父后，与 Vue 3 一致**（Vue 3 官方测试 `apiLifecycle.spec.ts` 断言：child onMounted → mid → root）；挂载是深度优先遍历，子组件先完成挂载；差异仅在我们同步触发、Vue 3 走 post 队列异步批量 | 无需处理；「父先子后」的是 `beforeMount`（Vue 3 同步、跟随遍历顺序） |
| `watch` 自动停止 | ✅ 已实现（本次提交，verify 场景 21）：组件实例持 `EffectScope`，setup 期间创建的 watch/computed/render effect 自动注册，组件卸载时 `scope.stop()` 统一停止；setup 外创建的 watch 仍需手动 stop（Vue 3 同） | 组件内 watch 无需手动清理 |
| `ErrorBoundary` 捕获后不自动恢复 | 触发 fallback 后持续显示直到边界重建 | 用 key 重建边界 |
| `lazy` 的 loader 需返回组件产物 | 须为 `defineComponent` 产物（setup 返回 render 函数）；`import('./x')` 用 `m.default` | 见 verify 场景 15 用法 |
| `effect` 内修改自身依赖的数组 | 异步队列场景下会无限循环（与 Vue 3 相同，属反模式）；同步场景已修复不爆栈（见已修复 Bug 1） | 事件 handler 内修改 |
| 空文本节点不残留 | 空文本不产生 DOM 节点（修复后）；多个连续空文本+后续节点同时恢复的边缘场景可能轻微错位 | 边缘场景少见 |
| 无具名插槽 | ✅ 已支持（本次提交，verify 场景 20）：`<template slot="name">...</template>` 编译期转换为 `slots` prop（Babel 插件），支持作用域参数（无值属性声明） | - |
| 组件函数体顶层是 setup 体（只执行一次） | 顶层响应式读取/抛错不会在更新时重跑；渲染期逻辑应放 JSX 表达式 | 见 verify 场景 15 注释 |

---

## 三、已修复 Bug 索引（详见 PLAN.md 完成记录）

- 数组方法不响应（d413312）｜`for...in`/`in` 不响应（34a8729）｜Date/Map 代理崩溃、readonly/markRaw/shallowReactive（6f892fd）
- 受控 input 光标跳动（caa6931）｜无调度批处理/无 nextTick（53b4af6）
- keyed diff 整体重排非最小移动（LIS）｜事件系统 `el.on*` 简陋（invoker + capture）
- `replace` 不卸载旧组件导致实例泄漏（bffcfd8 顺带修复）｜patch 复用失效实例不重建（74a0bd4 顺带修复）
- **effect 内修改数组爆栈**（c7e6c6e：`pauseTracking` + `run()` 重入保护 + `shouldTrack` 恢复）
- **同索引 diff 文本错位 + Fragment 文本索引偏移**（e060ebf：vnode 级 children 缓存，文本 el 跨 diff 持久化）
- **空文本节点残留**（本次提交：空文本不建节点/移除旧节点/恢复重建）

---

## 四、Vue 3 测试迁移（scripts/actview.test.tsx）

> 迁移来源：`E:\code3\vue3\packages\reactivity\__tests__\`（effect/reactive/reactiveArray/computed/watch 核心用例，45 个）。
> 适配：`effect`→`runEffect`、`stop`→`e.stop()`、watch 异步 flush 用 `await nextTick()`；跳过依赖未实现 API 的用例。

### 迁移检验出的框架 bug（本次已修复）

| Bug | 现象 | 修复 |
|---|---|---|
| **数组 length 依赖不触发** | `runEffect(() => dummy = arr.length)` 后 `push(1)`，dummy 不变。根因：JS 数组 length 自动同步，push 内部 `set('length')` 时 `oldValue === value`，检测不到变化 | 新增整数索引时显式 `trigger(target, 'length')`（Vue 3 同：ADD + 整数 key → 触发 length） |
| **不可写属性 set 失败仍触发依赖** | `Object.defineProperty(writable:false)` 后赋值，effect 被错误触发 | `Reflect.set` 失败（`result === false`）时不 trigger |
| **`reactive(proxy)` 不幂等** | 已代理对象再 `reactive()` 会再包一层代理 | `proxySet` 记录已创建代理，命中直接返回 |
| **非可扩展对象被代理** | `Object.preventExtensions` 对象被代理（Vue 3 不代理） | `shouldProxy` 加 `Object.isExtensible` 检查 |
| **`__v_skip` 对象被代理** | Vue 3 跳过带 `__v_skip` 的对象 | `shouldProxy` 加 `__v_skip` 检查 |
| **watch 对象源永不回调** | `watch(reactiveObj, cb)` 新旧值同为同一引用，`hasChanged` 恒 false | 对象/数组源视为 deep，回调始终触发（Vue 3 deep 语义） |

### 与 Vue 3 的语义差异（未实现，迁移时跳过）

- Map/Set/WeakMap/WeakSet 响应式代理（reactive.spec 相关用例）
- `isReactive` / `isReadonly` / `isProxy` / `toRaw` 工具函数
- `shallowReadonly` / `shallowRef` / `toRef` / `toRefs`
- `computed` setter（可写 computed）、`effectScope` 独立 API（我们有内部 EffectScope，未暴露全 API）
- `onWatcherCleanup` / `once` / `call` / `scheduler` 等 watch 选项
- 数组 identity 方法（`indexOf`/`includes` 对 reactive 元素的 toRaw 比较）
- ref 在 reactive 嵌套中的自动解包（Vue 3 有，我们无）
