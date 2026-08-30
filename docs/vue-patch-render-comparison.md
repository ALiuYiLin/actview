# Vue patch/render 架构对照 ActView —— 机制差异与借鉴路线

> 对照：Vue 3 `packages/runtime-core/src/renderer.ts`（2639 行） vs ActView `packages/core/src/runtime/renderer.ts` + `mountComponent.ts`。
> 背景：sameIndexAnchor / lazy 挂载 / Teleport 场景的 NotFoundError 连续暴露 patch 阶段「补丁式」设计的不足。Vue 的 patch 层经过多年 issue 打磨（#9071/#9313 等），ActView 应优先借鉴而非自研。
> 更新：2026-08。

---

## 一、Vue 的 patch 架构：anchor 是第一等参数，贯穿整条渲染链

Vue 的渲染器把 **anchor（插入锚点）作为 patch 链的一等参数**，从根渲染一路传递到每个挂载点：

```
patch(n1, n2, container, anchor, ...)          // renderer.ts:379-389，anchor 默认 null
 ├─ processElement → mountElement(n2, container, anchor, ...)   // 原生元素
 ├─ processComponent → mountComponent(n2, container, anchor, ...)
 ├─ processFragment → 双文本节点锚点（el + anchor）
 ├─ patchChildren(n1, n2, container, anchor, ...)  // :1642，anchor 第 4 参
 │   ├─ patchKeyedChildren(..., anchor, ...)        // :1663
 │   └─ patchUnkeyedChildren(..., anchor, ...)       // :1677
 └─ 类型不同替换：anchor = getNextHostNode(n1) 后 unmount（:395-399）
```

关键点：**anchor 不是事后计算，而是调用链上传递的既定位置**。ActView 的 anchor 是后来补丁式加的（`patch` 第 6 参、`mountVNode` 第 4/5 参、`mountComponent` deps），且各路径（组件更新 / replace / 同索引 / keyed）各自手写锚点计算——这是设计差异的根源。

## 二、Vue 有、ActView 没有/不同的机制

| # | 机制 | Vue（renderer.ts） | ActView 现状 | 影响 |
|---|---|---|---|---|
| 1 | **getNextHostNode**（按 vnode 类型递归求「后兄弟」） | `:2403-2416`：组件→subTree、Suspense→next()、Fragment→anchor 文本节点、**Teleport 内容跳过（TeleportEndKey，#9071/#9313）** | 无等价物——replace 手写 collectDomEls+nextSibling，组件更新用补丁式 nextSiblingVnode | 锚点计算分散、各场景手搓，是 NotFoundError 的结构根源 |
| 2 | **组件更新重算 anchor** | 每次 update：`patch(prevTree, nextTree, hostParentNode(prevTree.el), getNextHostNode(prevTree), ...)`（`:1544-1554`，注释「anchor may have changed if it's in a fragment」「parent may have changed if it's in a teleport」） | 补丁式 `deps.anchor`（首次）+ `nextSiblingVnode` 延迟求值（lazy） | 组件子树挂载位置靠后补，Teleport/Fragment 变位场景不稳 |
| 3 | **unkeyed 挂载 anchor 语义** | `anchor = c2[nextPos].el ?? parentAnchor`（`:1883`）——取**新列表**下一位 el，**fallback 父级贯穿的 parentAnchor** | `sameIndexAnchor(oldList, i)`——取**旧列表** i 之后第一个有 DOM 的节点，**无 parentAnchor fallback、无归属校验** | **当前 bug 的直接差异**：旧列表节点可能已卸载/跨容器（Teleport），anchor 不在容器 → NotFoundError |
| 4 | **async 组件 placeholder** | async 组件在 Suspense 边界渲染 **placeholder 文本节点**；diff 锚点用 `resolveAsyncComponentPlaceholder`（`:2627-2639`）兜底 | lazy 组件渲染 **null 占位（无 DOM）** → 列表 diff 无锚点，加载完成挂载靠补丁 nextSiblingVnode | lazy 在列表里锚点先天缺失 |
| 5 | **Fragment 双锚点** | Fragment 创建 `el` + `anchor` 两个文本节点（`:1069` `fragmentEndAnchor = hostCreateText('')`）→ 后兄弟搜索稳定 | Fragment **无自身 DOM**（靠 `__avChildren` 缓存列表自定义机制） | 文本混排时 nextSibling 搜索错位（Bug 3 类） |
| 6 | **patch 入口替换统一** | 类型不同 → `anchor = getNextHostNode(n1)` + unmount + n1=null（`:395-399`） | `replace()` 手写：collectDomEls + lastEl.nextSibling + 挂载后移动 | 替换逻辑独立实现，与同索引 anchor 不共享 |
| 7 | **vnode 复用** | 渲染的 children vnode 在 optimized/非 optimized 下经 `normalizeVNode`/`cloneIfMounted` **保留同位置 el**（新列表项的 el 非恒 null） | `patchChildren` 每帧 `normalizeChildren(newChildren).map(toVNode)` **重建 vnode** → 新列表项 el 恒 null → anchor 只能靠旧列表/容器内 DOM | 无法用 Vue 的「新列表下一位 el」直接取锚点 |
| 8 | **Teleport 参与 nextSibling 搜索的规避** | getNextHostNode 检测 `TeleportEndKey` 跳过 portal 内容（`:2412-2415`） | sameIndexAnchor 直接取 Teleport vnode 的 firstDomEl（= target 下 DOM）→ 插到错误父容器 | **Teleport 场景 NotFoundError 的直接根因（已验证复现）** |

## 三、当前 bug 的直接根因对照

`useListNavigation` 的 NotFoundError（列表过滤 + 动态变化）与 Teleport 验证用例同源：

```
Vue:   anchor = c2[nextPos].el ?? parentAnchor     // 新列表 + 父贯穿 fallback
ActView: sameIndexAnchor(oldList, i)               // 旧列表 i 后第一个有 DOM 的
        ↑ 假设：旧列表节点的 DOM 一定在当前容器内
        ✗ 过滤动态列表：旧节点已卸载/移动（el 残留引用）
        ✗ Teleport：旧节点 DOM 在 target 下（跨容器）
        → insertBefore(el, anchor) 时 anchor 不在 container → NotFoundError
```

Vue 的两个防护 ActView 都没有：**parentAnchor 贯穿**（挂载位置由父级给定，不依赖对旧列表 DOM 的猜测）+ **新列表语义**（锚点指向本次渲染后的位置）。

## 四、借鉴路线（建议分级）

> **执行状态（2026-08）：P-A/P-B/P-C 已全部落地**（`core-renderer-vue-align` changeset）：
> getNextHostNode（组件/Fragment/Teleport 跳过）、sameIndexAnchor 归属校验
> （container.contains）、组件更新锚点重算、lazy 占位文本节点、
> Fragment 结束位置（patch 链 anchor 传递，不引入额外节点）、
> unmount 删除 childNodes[index] 兜底（vnode 索引 ≠ DOM 索引）。
> 参考 Vue 的实现与 ActView 的实际约束（无 vnode 复用、childNodes 索引假设），
> Fragment 用「patch 链传位置」而非 Vue 的双文本节点锚点。

### P-A 最小修复（当前 bug，改动小）
1. `sameIndexAnchor` 加**归属校验**：`el && container.contains(el)` 才作 anchor，否则继续找/回退 append（一行级改动，直接消除 NotFoundError）
2. 同索引挂载 anchor 优先取**新列表 i+1 项的 el**（若已在容器内）再回退旧列表校验——对齐 Vue「新列表」语义

### P-B 结构借鉴（借鉴 Vue 的第一等设计，中等改动）
3. **anchor 贯穿**：`patch`/`patchChildren`/`patchKeyedChildren` 统一接收父级 anchor（容器尾部稳定点），挂载分支一律 `insertBefore(el, anchor ?? null)`——消灭各路径手写锚点
4. **getNextHostNode 等价物**：按 vnode 类型递归求后兄弟（组件→subTree、Fragment→__avChildren 末项、Teleport→跳过），组件更新/replace 统一调用
5. **组件更新统一锚点**：每次 update 用 getNextHostNode(prevSubTree)（对齐 `:1544-1554`），删除补丁式 nextSiblingVnode

### P-C 占位与锚点原生支持（根治 lazy/Fragment/Teleport）
6. **lazy placeholder**：lazy 组件未加载时渲染**占位文本节点**（而非 null），对齐 Vue async placeholder（`:2627`）——列表 diff 天然有锚点
7. **Fragment 锚点**：Fragment 携带尾部锚点节点（Vue 双锚点模式）——根治文本混排 nextSibling 搜索（Bug 3 类）
8. **Teleport nextSibling 规避**：getNextHostNode 检测 Teleport 内容并跳过（对齐 `:2412-2415`）

### 不建议照抄
- shapeFlag/patchFlag/dynamicChildren 编译期优化（ActView JSX 无编译期标记，属生态差异非缺陷）
- vnode 复用（每帧重建与 JSX 语义绑定，改动面大、收益有限；锚点问题用 P-A/B 已解决）

## 五、结论

ActView 的 patch 层「功能正确但锚点机制补丁化」——每个挂载场景（同索引/keyed/组件更新/替换/lazy/Teleport）各写一套锚点逻辑，互相不共享、不考虑跨容器归属。Vue 用「anchor 参数贯穿 + getNextHostNode 按类型递归」一个机制覆盖全部场景。建议按 P-A → P-B → P-C 逐步对齐，优先 P-A 止血当前 NotFoundError。
