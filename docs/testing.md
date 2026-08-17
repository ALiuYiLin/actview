# 测试工具实现原理（@actview/testing）

> 源码：`packages/testing/src/testing.ts`
> 对齐 testing-library 的查询/触发/等待心智模型，复用 `createApp().mount`。

---

## 1. 总览

把散落在 `test/*.test.tsx` 里的手写测试模式（`mount` + `collectText` + `flush`）收敛成公共 API：

```
render(Component)        → 挂载 + 返回 DOM 查询辅助
fireEvent(el, event)     → 触发 DOM 事件
waitFor(cb)              → 轮询等待异步更新
screen                   → 全局查询（最近 render）
cleanup()                → 卸载全部
```

---

## 2. render

```ts
export function render(component, options?) {
  const container = options?.container ?? document.createElement('div')
  const id = 'testing-' + mountSeq++
  container.id = id
  if (!options?.container) { document.body.appendChild(container); mountedContainers.push(container) }
  createApp(component).mount('#' + id)   // 复用框架挂载
  return { container, unmount, ...buildQueries(container) }
}
```

- **自动创建容器**：`id` 唯一（自增），避免 `querySelector` 命中旧容器
- **挂载复用 `createApp`**：走完整编译管线（Babel defineComponent + JSX）

---

## 3. 查询辅助（buildQueries）

| 方法 | 实现 |
|---|---|
| `getByText` / `queryByText` | 深度优先遍历子树（`walkElements`），`textContent.includes(text)`；get 找不到抛错、query 返回 null |
| `getAllByText` / `queryAllByText` | 全部匹配 |
| `getByClass` / `queryByClass` | `container.querySelector('.cls')` |
| `getByTestId` / `queryByTestId` | `container.querySelector('[data-testid="id"]')` |

`walkElements` 只遍历 `children`（元素），不含文本节点，所以文本匹配在元素层级做 `textContent` 包含判断。

---

## 4. fireEvent

```ts
export function fireEvent(el, event, options = {}) {
  if (options.value != null && 'value' in el) el.value = options.value
  el.dispatchEvent(new Event(event, { bubbles: options.bubbles ?? true }))
}
```

- `fireEvent(el, 'click')` → dispatch click（冒泡）
- `fireEvent(el, 'input', { value: 'x' })` → 先设 `el.value` 再 dispatch，配合受控 input 的 `onInput={(e) => e.target.value}`

---

## 5. waitFor（轮询）

```ts
export async function waitFor(cb, { timeout = 1000, interval = 20 } = {}) {
  for (;;) {
    try { await cb(); return }
    catch (e) { if (超时) throw e; await sleep(interval) }
  }
}
```

轮询执行断言（`getByText` 找不到抛错 → 继续等），直到通过或超时。解决异步响应式更新的等待（`nextTick` 后 + 动画 rAF）。

---

## 6. screen + cleanup

```ts
const mountedContainers: HTMLElement[] = []   // 模块级，记录自动创建的容器

export function cleanup() {
  for (const c of mountedContainers.splice(0)) c.remove()
}

export const screen = new Proxy({}, {
  get(_t, prop) {
    return buildQueries(currentContainer())[prop]  // 最近 render 的容器
  }
})
```

- `screen` 作用于 `mountedContainers` 最后一个（最近 render）
- `cleanup()` 移除全部容器 DOM（`afterEach(cleanup)` 隔离用例）

---

## 7. 设计取舍

| 项 | 决策 |
|---|---|
| 组件卸载 | `unmount` 用 `container.remove()`（移除 DOM）；框架暂无 `app.unmount` API（后续可补） |
| 查询匹配 | 文本用 `includes`（宽松）；class/testid 用精确选择器 |
| 事件触发 | 原生 `dispatchEvent`（无 React 合成事件） |
