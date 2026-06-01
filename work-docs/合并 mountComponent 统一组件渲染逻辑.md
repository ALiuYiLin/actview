# 合并 mountComponent 统一组件渲染逻辑

## 背景

`App.ts` 的 `mount` 和 `render.ts` 的组件分支做着完全相同的 4 步逻辑：

| 步骤 | App.ts mount | render.ts 组件分支 |
|------|-------------|-------------------|
| ① setup | `componentRenderFn = component({})` | `renderFn = vnode.type(props)` |
| ② render + mount | `render(componentRenderFn())` → `container.appendChild(n)` | `render(renderFn())` → `anchor.parentNode.insertBefore(n, ...)` |
| ③ 响应式包裹 | `update = () => { setCurrentUpdateFn(update); render(); setCurrentUpdateFn(prev) }` | 同上（变量名 `update`） |
| ④ 首次渲染 | `update()` | `prev = getCurrentUpdateFn(); setCurrentUpdateFn(update); doRender(); setCurrentUpdateFn(prev)` |

两套代码各自维护，后续添加 diff/patch 需要改两处。

## 改动

### render.ts — 新增 MountTarget 接口（+12 行）

```ts
export interface MountTarget {
  update(nodes: Node[], container: Node): void
}
```

将原先的 `clear()` + `appendChild()` 两个方法合并为 `update(nodes, container)` 一个。

### render.ts — 新增 mountComponent 函数（+47 行）

```ts
export function mountComponent(
  componentFn: (props: Record<string, unknown>) => () => VNodeChildren,
  container: Node,
  apply: MountTarget,
  props: Record<string, unknown> = {},
): { refresh: () => void }
```

内部 4 步：

```ts
// ① setup
const renderFn = componentFn(props)

// ② doRender
const doRender = () => {
  const vnode = renderFn()
  const dom = render(vnode)
  const nodes = Array.isArray(dom) ? dom : [dom]
  apply.update(nodes, container)
}

// ③ refresh（响应式）
const refresh = () => {
  const prev = getCurrentUpdateFn()
  setCurrentUpdateFn(refresh)
  doRender()
  setCurrentUpdateFn(prev)
}

// ④ 首次渲染 + 上下文劫持
const prev = getCurrentUpdateFn()
setCurrentUpdateFn(refresh)
doRender()
setCurrentUpdateFn(prev)

return { refresh }
```

关键设计：

- **`refresh`** 替代原 `update` 命名，避免和 `MountTarget.update` 混淆
- **首次渲染的上下文劫持** 统一放在 `mountComponent` 内部，不再区分 "App.ts 自然处于 update 中 / render.ts 需要显式劫持"
- **`doRender`** 是唯一在后续 diff/patch 时需要改动的内部函数

### render.ts — 组件分支从 40 行缩为 17 行

```
-  const renderFn = (vnode.type as ...)(props)
-  const anchor = document.createComment('')
-  let currentNodes: Node[] = []
-  const doRender = ...      删除
-  const update = ...         删除
-  const prev = ...; 劫持    删除
-  return [anchor, ...currentNodes]  保留

+  mountComponent(componentFn, anchor.parentNode ?? ..., {
+    update: (nodes) => {
+      currentNodes.forEach(n => n.parentNode?.removeChild(n))
+      currentNodes = []
+      const parent = anchor.parentNode
+      if (parent) nodes.forEach(n => parent.insertBefore(n, anchor.nextSibling))
+      currentNodes = nodes
+    },
+  }, props)
+  return [anchor, ...currentNodes]     ← 保留不变
```

render.ts 的 `update` 回调中 `_container` 参数未被使用（加下划线标注 unused），因为 render.ts 通过 `anchor.parentNode` 定位，不依赖外部传入的 container。

### App.ts — mount 从 35 行缩为 10 行

```
-  import { render } from './render'
-  import { getCurrentUpdateFn, setCurrentUpdateFn } from './reactivity/update'
+  import { mountComponent } from './render'

-  componentRenderFn = component({})
-  renderFn = () => { ... render(componentRenderFn()) ... container.appendChild ... }
-  update = () => { setCurrentUpdateFn(update); renderFn(); 恢复 }
-  update()

+  mountComponent(() => component({}), container, {
+    update: (nodes, el) => {
+      if (this.options.clearContainer) (el as HTMLElement).innerHTML = ''
+      nodes.forEach(n => el.appendChild(n))
+    },
+  })
```

删除了 4 个 import/变量/函数（`render`、`getCurrentUpdateFn`、`setCurrentUpdateFn`、`@returns` 注释）。

`el` 类型为 `Node`，因 `innerHTML` 是 `HTMLElement` 独有，需 `(el as HTMLElement)` 断言。

## 对比提交 `50711d7`

`git diff HEAD` （自最近一次提交 `50711d7 fix: 解决 JSX 组件模式类型校验不兼容`）

### 变更统计

| 文件 | 状态 | 行变化 |
|------|------|--------|
| `packages/core/src/App.ts` | 修改 | -25 行 |
| `packages/core/src/render.ts` | 修改 | +60 / -42 行 |
| `packages/core/src/reactivity/ref.ts` | 未变 | — |
| `packages/core/src/reactivity/event.ts` | 未变 | — |

### App.ts 逐行 diff

```diff
  import type { Component } from '@actview/jsx'
- import { render } from './render'
- import { getCurrentUpdateFn, setCurrentUpdateFn } from './reactivity/update'
+ import { mountComponent } from './render'

-  /// @returns          挂载的根 DOM 节点

-  const componentRenderFn = component({})          // ← setup
-  const renderFn = () => {                          // ← render + mount
-    if (this.options.clearContainer) container.innerHTML = ''
-    const vnode = componentRenderFn()
-    const dom = render(vnode)
-    const nodes = Array.isArray(dom) ? dom : [dom]
-    for (const node of nodes) container.appendChild(node)
-  }
-  const update = () => {                            // ← 响应式包裹
-    const prev = getCurrentUpdateFn()
-    setCurrentUpdateFn(update)
-    renderFn()
-    setCurrentUpdateFn(prev)
-  }
-  update()                                           // ← 首次渲染

+  mountComponent(() => component({}), container, {   // ← 一行替代上面全部
+    update: (nodes, el) => {
+      if (this.options.clearContainer) (el as HTMLElement).innerHTML = ''
+      nodes.forEach(n => el.appendChild(n))
+    },
+  })
```

### render.ts 逐行 diff

**新增 MountTarget + mountComponent（44 行）:**

```diff
+ export interface MountTarget {
+   update(nodes: Node[], container: Node): void
+ }
+
+ export function mountComponent(
+   componentFn: (props: Record<string, unknown>) => () => VNodeChildren,
+   container: Node,
+   apply: MountTarget,
+   props: Record<string, unknown> = {},
+ ): { refresh: () => void } {
+   const renderFn = componentFn(props)
+   const doRender = () => {
+     const vnode = renderFn()
+     const dom = render(vnode)
+     const nodes = Array.isArray(dom) ? dom : [dom]
+     apply.update(nodes, container)
+   }
+   const refresh = () => {
+     const prev = getCurrentUpdateFn()
+     setCurrentUpdateFn(refresh)
+     doRender()
+     setCurrentUpdateFn(prev)
+   }
+   const prev = getCurrentUpdateFn()
+   setCurrentUpdateFn(refresh)
+   doRender()
+   setCurrentUpdateFn(prev)
+   return { refresh }
+ }
```

**组件分支替换（-42 / +17 行）:**

```diff
  if (typeof vnode.type === 'function') {
-   const renderFn = (vnode.type as ...)(props)
-   const anchor = document.createComment('')
-   let currentNodes: Node[] = []
-   const doRender = (): Node[] => {
-     currentNodes.forEach(n => n.parentNode?.removeChild(n))
-     currentNodes = []
-     const newDom = render(renderFn())
-     const nodes = Array.isArray(newDom) ? newDom : [newDom]
-     currentNodes = nodes
-     if (anchor.parentNode) {
-       nodes.forEach(n => anchor.parentNode!.insertBefore(n, anchor.nextSibling))
-     }
-     return nodes
-   }
-   const update = () => {
-     const prev = getCurrentUpdateFn()
-     setCurrentUpdateFn(update)
-     doRender()
-     setCurrentUpdateFn(prev)
-   }
-   const prev = getCurrentUpdateFn()
-   setCurrentUpdateFn(update)
-   doRender()
-   setCurrentUpdateFn(prev)

+   const componentFn = vnode.type as ...
+   const anchor = document.createComment('')
+   let currentNodes: Node[] = []
+   mountComponent(componentFn, anchor.parentNode ?? ..., {
+     update: (nodes, _container) => {
+       currentNodes.forEach(n => n.parentNode?.removeChild(n))
+       currentNodes = []
+       const parent = anchor.parentNode
+       if (parent) nodes.forEach(n => parent.insertBefore(n, anchor.nextSibling))
+       currentNodes = nodes
+     },
+   }, props)

    return [anchor, ...currentNodes]
  }
```

## 为后续 diff/patch 铺路

替换 `mountComponent` 内部的 `doRender` 即可：

```ts
// 当前：全量重建 → render + apply.update
const doRender = () => {
  const vnode = renderFn()
  const dom = render(vnode)
  const nodes = Array.isArray(dom) ? dom : [dom]
  apply.update(nodes, container)
}

// 未来：patch(oldVNode, newVNode)
const doRender = () => {
  const newVNode = renderFn()         // 不变
  patch(oldVNode, newVNode, container) // ← 替换 render + apply.update
  oldVNode = newVNode
}
```

`MountTarget.update` 接口不变，`refresh` 的响应式循环机制不变。
