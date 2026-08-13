# @actview/store

ActView 的组合式状态管理库。对齐 Pinia setup store，但保持 TSX + 组合式 API 风格：**用 `reactive`/`computed` 定义状态，`defineStore` 提供单例与类型推导**。

## 安装

```bash
pnpm add @actview/store
```

## 快速开始

```tsx
import { reactive, computed } from 'actview'
import { defineStore } from '@actview/store'

export const useCounter = defineStore('counter', () => {
  const state = reactive({ count: 0 })
  const double = computed(() => state.count * 2)
  function inc() {
    state.count++
  }
  return { state, double, inc }
})
```

组件中使用：

```tsx
function Counter() {
  const counter = useCounter() // 单例：多次调用返回同一实例
  return (
    <button onClick={() => counter.inc()}>
      {counter.state.count}（double: {counter.double.value}）
    </button>
  )
}
```

## API

| 导出 | 说明 |
|---|---|
| `defineStore(id, setup)` | 定义 store，返回 `useStore`（懒创建单例） |
| `applyPlugin(fn)` | 注册插件，store 创建时调用 `fn({ id, state })` |
| `resetStore(id)` | 重置指定 store（下次 `useStore` 重新执行 setup） |
| `resetAllStores()` | 重置全部 |
| `getActiveStoreIds()` | 已创建的 store id 列表 |
| `getStore(id)` | 获取 store 实例（未创建返回 undefined） |

## 插件示例：持久化

```ts
import { watch } from 'actview'
import { applyPlugin } from '@actview/store'

applyPlugin(({ id, state }) => {
  // 恢复
  const saved = localStorage.getItem(id)
  if (saved) Object.assign(state, JSON.parse(saved))
  // 订阅持久化
  watch(state, () => localStorage.setItem(id, JSON.stringify(state)), { deep: true })
})
```

## 特点

- **零样板**：`useStore()` 返回类型由 `setup` 返回类型自动推导
- **响应式**：`reactive` 状态 + `computed` 派生，组件读取自动追踪
- **单例**：同 id 跨模块复用，避免重复创建
- **可测试**：`resetAllStores()` 清理，测试间隔离
