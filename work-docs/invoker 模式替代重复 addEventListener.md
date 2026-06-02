# invoker 模式替代重复 addEventListener

## 问题

patch 更新事件属性时，`setProp` 每次调用 `addEventListener` 绑新 handler，旧 handler 从未移除。N 次更新后累积 N 个事件处理器，点击一次全部触发。

## invoker 模式（同 Vue）

**核心思想**：每个元素/事件对只 `addEventListener` 一次，后续更新只改闭包引用。

```
首次:  el._inv.click = invoker
       invoker.value = handler1
       addEventListener('click', invoker)

更新:  invoker.value = handler2     ← 不碰 DOM

点击:  invoker(e) → invoker.value(e) → handler2(e)
```

## 代码实现

`render.ts` 新增 `mountEvent` 函数并导出：

```ts
export function mountEvent(el: HTMLElement, key: string, handler: EventListener) {
  const elAny = el as unknown as Record<string, unknown>
  let invokers = elAny._inv as Record<string, Function> | undefined
  if (!invokers) {
    invokers = {}
    elAny._inv = invokers
  }

  let invoker = invokers[key] as undefined | (EventListener & { value: EventListener })

  if (!invoker) {
    // 首次 → 创建 invoker + addEventListener
    invoker = ((e: Event) => invoker!.value(e)) as EventListener & { value: EventListener }
    invoker.value = handler
    ;(invokers as Record<string, unknown>)[key] = invoker
    el.addEventListener(key.slice(2).toLowerCase(), invoker)
  } else {
    // 更新 → 只改引用
    invoker.value = handler
  }
}
```

## 调用方

**`render.ts` — applyProps（首次渲染）：**

```ts
// 改前
if (key.startsWith('on')) {
  const eventName = key.slice(2).toLowerCase()
  el.addEventListener(eventName, value as EventListener)
}

// 改后
if (key.startsWith('on')) {
  mountEvent(el, key, value as EventListener)
}
```

**`patch.ts` — setProp（更新渲染）：**

```ts
// 改前
if (key.startsWith('on')) {
  const eventName = key.slice(2).toLowerCase()
  el.addEventListener(eventName, value as EventListener)
}

// 改后
if (key.startsWith('on')) {
  mountEvent(el, key, value as EventListener)
}
```

`patchProps` 不再需要 `removeEventListener`，代码回到只调 `setProp` 的干净形式：

```ts
if (oldVal !== value) {
  setProp(el, key, value)  // setProp 内部用 invoker 模式管理事件
}
```

## 对比其他框架

| 框架 | 策略 | 是否每次更新操作 DOM |
|------|------|-------------------|
| React | 事件委托到根节点，内存映射表 | ❌ 从不操作 DOM 事件 |
| Vue | invoker 包装，只绑一次 | ❌ 只改 value 引用 |
| 本框架（改前） | 每次 patch 都 `addEventListener` | ✅ 每次操作 DOM |
| **本框架（改后）** | **invoker 包装，只绑一次** | **❌ 只改 value 引用** |

## 文件变更

| 文件 | 变更 |
|------|------|
| `packages/core/src/render.ts` | `applyProps` 事件分支改为调用 `mountEvent`；新增 `mountEvent` 函数并导出 |
| `packages/core/src/patch.ts` | `setProp` 事件分支改为调用 `mountEvent`（从 `render.ts` 导入）；删除先前添加的 `removeEventListener` 逻辑 |
