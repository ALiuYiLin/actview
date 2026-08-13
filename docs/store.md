# 状态管理实现原理（@actview/store）

> 源码：`packages/store/src/store.ts`
> 对齐 Pinia setup store，但复用 ActView 的 `reactive`/`computed`，**不引入新概念**。

---

## 1. 核心思想

ActView 的响应式内核已经很强，状态管理本质是**薄封装**：组合式函数 + 单例缓存 + name。

```ts
const useCounter = defineStore('counter', () => {
  const state = reactive({ count: 0 })
  const double = computed(() => state.count * 2)
  function inc() { state.count++ }
  return { state, double, inc }
})

const counter = useCounter()  // 单例：多次调用返回同一实例
counter.inc()                 // state.count++ → 组件自动更新
```

不需要 reducer/immutable/action 分发——`reactive` 直接改，`computed` 派生，组件读取自动追踪。

---

## 2. 单例缓存

```ts
const registry = new Map<string, StoreContext>()

export function defineStore<Setup extends () => any>(id, setup) {
  const useStore = () => {
    let inst = registry.get(id)
    if (!inst) {
      inst = { id, state: setup() }
      registry.set(id, inst)
      for (const p of plugins) p(inst)   // 插件
    }
    return inst.state as ReturnType<Setup>
  }
  return useStore
}
```

- **懒创建**：首次 `useStore()` 才执行 setup
- **全局单例**：`registry` 是模块级 Map，同 id 跨模块复用（多个文件 import 同一个 `useCounter` 返回同一实例）
- **类型推导**：`useStore()` 返回类型 = `ReturnType<Setup>`（零样板）

---

## 3. 响应式

setup 返回对象里的 `reactive`/`computed` 天然响应式：组件里 `const c = useStore(); c.state.count` 读取 → `track`，store 修改 → `trigger` → 组件更新。store 不需要额外的发布订阅。

---

## 4. 插件机制

```ts
export type StorePlugin = (ctx: StoreContext) => void

const plugins: StorePlugin[] = []
export function applyPlugin(plugin) { plugins.push(plugin) }
```

store 创建时调用 `plugin({ id, state })`。典型用途：

```ts
// 持久化插件
applyPlugin(({ id, state }) => {
  const saved = localStorage.getItem(id)
  if (saved) Object.assign(state, JSON.parse(saved))
  watch(state, () => localStorage.setItem(id, JSON.stringify(state)), { deep: true })
})
```

---

## 5. reset / 调试

```ts
resetStore(id)        // registry.delete(id)，下次 useStore 重新 setup
resetAllStores()      // 清空（测试隔离）
getActiveStoreIds()   // 已创建 store id（DevTools 用）
getStore(id)          // 取实例（未创建 undefined）
```

---

## 6. 设计取舍

| 项 | 决策 |
|---|---|
| 选项式（state/getters/actions） | ❌ 不做，组合式 setup store 已够（TSX 风格） |
| ref 自动解包 | ❌ 不做（框架已砍），store 内用 `reactive` 对象，读 `.state.count` |
| SSR 状态注入 | 后续（配合 SSR/hydration 计划，见 gap-analysis.md 第四节） |
| 命名空间隔离 | 单例按 id 隔离，无嵌套 store |
