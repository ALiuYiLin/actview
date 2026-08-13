# DevTools 实现原理（@actview/devtools）

> 源码：`packages/core/src/devtools.ts`（core 埋点）、`packages/devtools/src/devtools.ts`（后端收集 + 面板）
> 分两层：core 零侵入埋点 + devtools 后端收集/暴露。

---

## 1. 总览

```
core（埋点，零侵入）                    @actview/devtools（后端）
  mountComponent 挂载/更新/卸载 ──→  onComponentMount/Update/Unmount
  reactive-system track/trigger ──→  onTrack/onTrigger
                                          │
                                          ↓ 收集组件树 + 事件流
                                          ↓ 暴露 window.__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__
                                          ↓（浏览器扩展 / mountPanel 面板接入）
```

---

## 2. core 埋点（devtools.ts）

```ts
export interface DevtoolsHook {
  onComponentMount?/onComponentUpdate?/onComponentUnmount?: (info) => void
  onTrack?/onTrigger?: (e: { target, key }) => void
}

let hook: DevtoolsHook | null = null
export function setDevtoolsHook(h) { hook = h }
export function getDevtoolsHook() { return hook }
```

- **零开销**：`hook` 为空时，`getDevtoolsHook()?.onXxx?.()` 只是一次空判断，不侵入框架主流程
- **挂载/更新/卸载**：`mountComponent` 的 `update()` 末尾按 `wasMounted` 区分 mount/update；`unmount` 末尾上报
- **track/trigger**：`reactive-system` 的 `track`/`trigger` 开头调用
- **组件名**：`instance.name`（`defineComponent` 第二参数 name，Babel 从变量名传递）

---

## 3. 组件树收集

```ts
const tree = new Map<number, TreeNode>()
// TreeNode = { id, name, parentId, children }

onComponentMount(info) {
  tree.set(info.id, { id, name, parentId: info.parent?.id ?? null, children: [] })
  if (parentId != null && tree.has(parentId)) tree.get(parentId).children.push(id)
  // 回填：子先于父挂载（同步深度优先），父节点创建后补 children
  for (const other of tree.values())
    if (other.parentId === info.id && !node.children.includes(other.id))
      node.children.push(other.id)
}
```

**关键坑**：挂载顺序是**子先父后**（父 update 里递归 patch 子，子的 onComponentMount 先触发）。父节点创建时，已挂载的子需「回填」到 `children`。

`parentId` 来自 `info.parent?.id`（`instance.parent` 链，mountComponent 挂载参数传递）。

---

## 4. 事件流

```ts
const events: EventEntry[] = []   // 限长 1000（环形，超出 shift）

pushEvent({ type: 'mount' | 'update' | 'unmount' | 'track' | 'trigger', ... })
```

- `track` 高频不 `notify`（避免性能问题），`trigger` 等通知订阅者
- `snapshot()` 返回 `{ tree, events }` 供面板渲染

---

## 5. window hook 暴露

```ts
const api = {
  getComponentTree: () => Array.from(tree.values()),
  getEventLog: () => events.slice(),
  subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
  reset: () => { tree.clear(); events.length = 0; notify() }
}
window.__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__ = api
```

浏览器扩展通过该 hook 读组件树/事件流，实现可视化面板（content script 通信）。

---

## 6. 面板浮层（mountPanel）

```ts
export function mountPanel(container?) {
  // 固定定位浮层（右下角），subscribe 快照变化 → 渲染组件树（缩进）+ 事件流（文本）
  const render = (snap) => {
    const depth = computeDepth(snap.tree)   // parentId 递归求深度
    host.textContent = `=== 组件树 ===\n${缩进树}\n\n=== 事件流 ===\n${最近20条}`
  }
  api.subscribe(render)
}
```

最小可用：纯 DOM 文本面板（组件树缩进 + 事件流），`initDevTools()` + `mountPanel()` 即可在页面右下角看到。

---

## 7. 设计取舍

| 项 | 决策 |
|---|---|
| 组件 state 展示 | ❌ 不展示（组合式 API 的 state 是 setup 闭包变量，不在实例上）；展示「响应式事件流」（trigger 的 key）替代 |
| 性能 | track 高频不 notify；事件流限长 1000 |
| 面板 | 最小文本浮层（完整可视化面板留浏览器扩展） |
| SSR | 后续配合 SSR 埋点（可选） |
