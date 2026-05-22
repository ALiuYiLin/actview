# ActView 编译渲染与 Diff 更新机制详解

本文档详细介绍 ActView 框架的核心渲染管线：从 JSX 工厂创建真实 DOM，到响应式驱动更新，再到 Diff 算法高效比较并更新元素的完整流程。

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [JSX 工厂：从 JSX 到真实 DOM](#2-jsx-工厂从-jsx-到真实-dom)
3. [响应式系统：自动追踪与触发更新](#3-响应式系统自动追踪与触发更新)
4. [编译系统：bindRender 与元素渲染](#4-编译系统bindrender-与元素渲染)
5. [Diff 算法：高效比较与更新](#5-diff-算法高效比较与更新)
6. [Keyed Diff：基于 key 的列表更新](#6-keyed-diff基于-key-的列表更新)
7. [Fragment 锚点追踪机制](#7-fragment-锚点追踪机制)
8. [完整渲染流程示例](#8-完整渲染流程示例)

---

## 1. 整体架构概览

ActView 的渲染更新流程可概括为以下管线：

```
JSX 代码
  │
  ▼  esbuild (react-jsx transform)
jsx(tag, props, key) 调用
  │
  ▼  @actview/jsx 工厂
真实 DOM 元素 (HTMLElement / DocumentFragment)
  │
  ▼  compile.ts 编译绑定
注册 updateFn 到响应式系统
  │
  ▼  reactive 数据变更
EventBus 通知 → 重新执行 render()
  │
  ▼  bindRender()
生成新 DOM 树
  │
  ▼  diff() / patchKeyedChildren()
最小化 DOM 操作，原地更新
```

**核心文件：**

| 文件 | 职责 |
|------|------|
| `packages/jsx/jsx.ts` | JSX 工厂函数，将 JSX 转为真实 DOM |
| `packages/core/runtime/compile.ts` | 编译系统，绑定响应式更新、执行渲染 |
| `packages/core/runtime/diff.ts` | Diff 算法，最小化 DOM 更新 |
| `packages/core/reactivity/` | 响应式系统（reactive、ref、eventBus） |

---

## 2. JSX 工厂：从 JSX 到真实 DOM

### 2.1 编译阶段：esbuild 的 react-jsx 转换

项目配置 `tsconfig.jsx.json` 中 `"jsx": "react-jsx"`、`"jsxImportSource": "@actview/jsx"`。esbuild 会将 JSX 语法编译为函数调用：

```tsx
// 源代码
<tr key={student.id}>
  <td>{student.name}</td>
</tr>

// 编译产物
jsx("tr", { children: [
  jsx("td", { children: student.name })
] }, student.id)
//                        ↑ key 是独立的第三个参数
```

**关键点：** `react-jsx` 模式下，`jsx(tag, props, key)` 的签名中 `key` 是独立的第三个参数（不在 props 中），这与 `createElement(tag, props, ...children)` 的签名完全不同。

### 2.2 jsx() 函数：入口适配层

```ts
// packages/jsx/jsx.ts
export function jsx(tag, props, key?) {
  if (tag === Fragment) return Fragment(props || {});
  // 将独立的 key 参数合并回 props
  if (key != null) {
    props = props ? { ...props, key } : { key };
  }
  return createElement(tag, props);
}
export const jsxs = jsx;  // 静态子节点版本，行为一致
```

`jsx()` 的核心职责是**适配 esbuild 的调用签名**——将独立的 `key` 参数合并回 `props`，然后委托给 `createElement` 完成实际创建。

### 2.3 createElement()：真实 DOM 创建

`createElement` 是整个 JSX 工厂的核心，处理两大类情况：

#### (a) 函数组件

```ts
if (typeof tag === "function") {
  const mergedProps = { ...props };
  const defaultChildren = [];

  // 处理 <template slot="xxx"> 插槽语法
  for (const child of allChildren) {
    if (child instanceof HTMLTemplateElement && child.getAttribute("slot")) {
      const slotName = child.getAttribute("slot");
      mergedProps[slotName] = Array.from(child.childNodes);
    } else {
      defaultChildren.push(child);
    }
  }

  mergedProps.children = defaultChildren;
  return tag(mergedProps);  // 调用组件函数，返回 DOM
}
```

**函数组件处理流程：**
1. 遍历所有 children，识别带 `slot` 属性的 `<template>` 元素
2. 将插槽内容提取到 `props[slotName]`（如 `props.before`、`props.after`）
3. 其余 children 归入 `props.children`
4. 调用组件函数 `tag(mergedProps)` 并返回其结果

#### (b) 原生 HTML/SVG 元素

```ts
// 创建元素（SVG 需要使用命名空间）
const element = isSvg
  ? document.createElementNS(SVG_NS, tagName)
  : document.createElement(tagName);
```

**属性处理规则：**

| props key | 处理方式 |
|-----------|---------|
| `children` | 跳过，单独由 `appendChildren` 处理 |
| `key` | **不设为 HTML attribute**，存储到 `element._key` 供 diff 使用 |
| `className` / `class` | 设为 `class` attribute |
| `style`（对象） | `Object.assign(element.style, value)` |
| `on*`（函数） | 提取事件名，`addEventListener` 绑定，同时记录到 `_listeners` |
| 其他 | `setAttribute(key, String(value))` |

**子元素递归添加（appendChildren）：**

```ts
function appendChildren(parent, children) {
  for (const child of children) {
    if (child == null || typeof child === "boolean") continue;
    else if (Array.isArray(child)) appendChildren(parent, child);  // 递归展平（支持 .map()）
    else if (typeof child === "string" || typeof child === "number")
      parent.appendChild(document.createTextNode(String(child)));
    else if (child instanceof Node) parent.appendChild(child);
  }
}
```

### 2.4 Fragment：无根节点容器

```ts
export function Fragment(props) {
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, Array.isArray(children) ? children : [children]);
  return fragment;
}
```

`Fragment` 返回 `DocumentFragment`，它在插入 DOM 后自身消失，只保留其子节点。这带来了特殊的追踪难题——由 compile.ts 的锚点机制解决（见第 7 节）。

---

## 3. 响应式系统：自动追踪与触发更新

### 3.1 依赖收集

`reactive()` 通过 `Proxy` 拦截属性读取：

```ts
get(target, key) {
  const currentUpdateFn = getCurrentUpdateFn();
  // 如果正在执行某个 updateFn，就将它订阅到当前 reactive 对象的 triggerRef
  if (currentUpdateFn) eventBus.subscribe(triggerRef, currentUpdateFn);
  return target[key];
}
```

### 3.2 触发更新

当 reactive 对象的属性被修改：

```ts
set(target, key, newValue) {
  if (oldValue !== newValue) {
    target[key] = newValue;
    eventBus.publish(triggerRef);  // 通知所有订阅的 updateFn 重新执行
  }
}
```

### 3.3 更新链路

```
reactive.set() → eventBus.publish() → updateFn() → bindRender() → diff()
```

---

## 4. 编译系统：bindRender 与元素渲染

### 4.1 compileElement：建立响应式绑定

```ts
function compileElement(el, option) {
  let currentEl = el;

  const updateFn = () => {
    bindShow(currentEl, show);
    bindText(currentEl, text);
    bindValue(currentEl, value);
    currentEl = bindRender(currentEl, render);  // 核心：渲染并 diff
  };

  setCurrentUpdateFn(updateFn);  // 标记当前正在执行的 updateFn（供响应式依赖收集）
  updateFn();                     // 首次执行：渲染 + 收集依赖
  setCurrentUpdateFn(null);       // 清除标记
}
```

**关键设计：** `updateFn` 内部访问 reactive 数据时，响应式系统自动收集 `updateFn` 为依赖。后续数据变更时，`updateFn` 被自动重新调用。

### 4.2 bindRender：核心渲染函数

`bindRender` 是整个编译系统的枢纽，负责执行 `render()` 函数并将结果应用到 DOM。它根据 `render()` 返回值的类型，走不同的更新路径：

```ts
function bindRender(currentEl, render) {
  if (!render || typeof render !== "function") return currentEl;

  const result = render();  // 调用 render，得到新的 DOM 结构
  // ...根据 result 类型分支处理
}
```

#### 路径 1：HTML 字符串

```ts
if (typeof result === "string") {
  const temp = document.createElement("div");
  temp.innerHTML = result.trim();
  const newEl = temp.firstElementChild;
  if (newEl) return diff(currentEl, newEl);
}
```

将字符串解析为 DOM 元素，然后调用 `diff()` 比较更新。

#### 路径 2：DocumentFragment（列表渲染）

这是最复杂的路径，详见第 7 节。核心思路：通过首尾锚点注释节点追踪 Fragment 的位置范围，在更新时收集锚点间的旧子节点，与新子节点进行 diff。

#### 路径 3：Element（单元素）

```ts
if (result instanceof Element) {
  return diff(currentEl, result);
}
```

直接调用 `diff()` 做原地更新。

### 4.3 bindRender 的返回值设计

`bindRender` 始终返回一个 `Element` 作为**跟踪元素**（tracker element）。这个返回值会赋值给 `currentEl`，确保下一轮更新时 `currentEl` 仍然指向 DOM 中的正确位置：

```ts
const updateFn = () => {
  // ...
  currentEl = bindRender(currentEl, render);
  //        ↑ 更新跟踪引用
};
```

---

## 5. Diff 算法：高效比较与更新

### 5.1 diff() 函数：顶层分派

```ts
export function diff(oldNode, newNode): Node {
  // 1. 类型/标签名不同 → 直接替换
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
    oldNode.parentNode?.replaceChild(newNode, oldNode);
    return newNode;
  }

  // 2. 文本节点 → 更新 textContent
  if (oldNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent)
      oldNode.textContent = newNode.textContent;
    return oldNode;
  }

  // 3. 元素节点 → 属性 + 事件 + 子节点
  if (oldNode instanceof HTMLElement && newNode instanceof HTMLElement) {
    updateAttributes(oldNode, newNode);
    updateListeners(oldNode, newNode);
    updateChildren(oldNode, newNode);
    return oldNode;
  }

  // 4. DocumentFragment → 不可追踪，由 compile 层处理
  return oldNode;
}
```

**核心原则：尽量复用旧 DOM 节点。** `diff()` 返回值为更新后实际在 DOM 中的节点——如果是属性更新，返回旧节点（已被原地修改）；如果是替换操作，返回新节点。

### 5.2 updateAttributes：属性比较

```ts
function updateAttributes(oldNode, newNode) {
  // 1. 移除旧节点上有、新节点上没有的属性
  for (const attr of oldNode.attributes) {
    if (!newNode.hasAttribute(attr.name))
      oldNode.removeAttribute(attr.name);
  }

  // 2. 设置新节点上的属性（值不同才更新）
  for (const attr of newNode.attributes) {
    if (oldNode.getAttribute(attr.name) !== attr.value)
      oldNode.setAttribute(attr.name, attr.value);
  }

  // 3. 特殊处理 value property（input/textarea 受控组件逻辑）
  // 只有新节点明确设置了 value 属性时才同步，避免清空非受控组件的用户输入
}
```

### 5.3 updateListeners：事件监听比较

通过 `_listeners` 对象（在 JSX 工厂创建时记录）跟踪事件：

```ts
function updateListeners(oldNode, newNode) {
  // 移除旧节点上不再存在或已改变的事件
  // 添加新节点上新增的事件
  // 更新 _listeners 记录
}
```

### 5.4 updateChildren：子节点比较

```ts
function updateChildren(oldParent, newParent) {
  const oldChildren = Array.from(oldParent.childNodes);
  const newChildren = Array.from(newParent.childNodes);

  // 检测 key → 走 keyed diff
  if (hasKeyedChildren(newChildren)) {
    patchKeyedChildren(oldParent, oldChildren, newChildren);
    return;
  }

  // 无 key → index-based diff（按位置逐个比较）
  for (let i = 0; i < maxLength; i++) {
    if (!oldChild && newChild)      oldParent.appendChild(newChild);     // 新增
    else if (oldChild && !newChild) oldParent.removeChild(oldChild);     // 删除
    else if (oldChild && newChild)  diff(oldChild, newChild);            // 递归 diff
  }
}
```

**Index-based diff 的局限性：** 当列表顺序变化时（如排序、头部插入），节点按位置配对会导致大量不必要的属性更新，且 **DOM 状态（如 input 中的用户输入）不会随数据移动**——这就是需要 keyed diff 的原因。

---

## 6. Keyed Diff：基于 key 的列表更新

### 6.1 Key 的传递链路

```
JSX 源码         →   esbuild 编译      →   jsx() 函数        →   createElement()
<tr key={id}>        jsx("tr",{...},id)     props={...key:id}     element._key = id
```

1. **esbuild** 将 `key` 提取为 `jsx()` 的第三个参数
2. **`jsx()`** 将 `key` 合并回 `props`
3. **`createElement()`** 从 `props.key` 读取，存储到 `element._key`（不设为 HTML attribute）

### 6.2 patchKeyedChildren 算法

```ts
function patchKeyedChildren(parent, oldChildren, newChildren, anchor?) {
  // Step 1: 建立旧 key → node 映射
  const oldKeyMap = new Map();
  for (const child of oldChildren) {
    const key = getKey(child);  // 读取 node._key
    if (key !== undefined) oldKeyMap.set(key, child);
  }

  // Step 2: 遍历新子节点，匹配旧节点
  const handledOldNodes = new Set();
  const resultNodes = [];

  for (const newChild of newChildren) {
    const key = getKey(newChild);
    const oldChild = key !== undefined ? oldKeyMap.get(key) : undefined;

    if (oldChild) {
      diff(oldChild, newChild);     // 复用旧 DOM，更新属性
      resultNodes.push(oldChild);   // 保留旧节点引用
      handledOldNodes.add(oldChild);
    } else {
      resultNodes.push(newChild);   // 全新节点
    }
  }

  // Step 3: 删除不再出现的旧节点
  for (const child of oldChildren) {
    if (!handledOldNodes.has(child)) parent.removeChild(child);
  }

  // Step 4: 按新顺序调整 DOM 位置（从后往前）
  let insertAnchor = anchor ?? null;
  for (let i = resultNodes.length - 1; i >= 0; i--) {
    const node = resultNodes[i];
    if (node.parentNode !== parent || node.nextSibling !== insertAnchor) {
      parent.insertBefore(node, insertAnchor);
    }
    insertAnchor = node;
  }
}
```

**四步流程：**

| 步骤 | 操作 | 目的 |
|------|------|------|
| 1. 建立映射 | `oldKeyMap: key → oldNode` | O(1) 查找旧节点 |
| 2. 匹配复用 | 遍历 newChildren，从 map 中查找 | 复用旧 DOM（保留 input 状态等），仅更新属性差异 |
| 3. 删除多余 | 删除未被匹配的旧节点 | 清理已移除的数据对应的 DOM |
| 4. 调整顺序 | 从后往前 insertBefore | 将 DOM 顺序调整为与新数据一致 |

**为什么从后往前调整顺序？** 从后往前遍历时，`insertAnchor` 始终指向上一个已定位的节点，使用 `insertBefore(node, insertAnchor)` 就能将当前节点放到正确位置。这避免了从前往后时需要额外计算参考点的问题。

### 6.3 Keyed vs Index-based 对比

以"头部插入"为例（原列表 `[A, B, C]`，新列表 `[D, A, B, C]`）：

**Index-based（无 key）：**
```
位置 0: A → D  （更新属性，但 A 的 input 状态留在位置 0）
位置 1: B → A  （更新属性）
位置 2: C → B  （更新属性）
位置 3: 无 → C （新建）
结果：4 次 DOM 操作，input 状态全部错位
```

**Keyed diff：**
```
D: map 中找不到 → 新建
A: map 中找到 oldA → diff(oldA, newA)，复用（保留 input 状态）
B: map 中找到 oldB → diff(oldB, newB)，复用
C: map 中找到 oldC → diff(oldC, newC)，复用
调整顺序：将 D 移到最前面
结果：1 次 DOM 插入，input 状态随数据正确移动
```

---

## 7. Fragment 锚点追踪机制

### 7.1 问题

`DocumentFragment` 插入 DOM 后自身消失，无法被追踪。但列表渲染（`array.map(...)`）返回的就是 Fragment，后续更新时需要知道"旧的列表子节点在 DOM 中的哪些位置"。

### 7.2 解决方案：首尾锚点注释节点

```html
<!-- 实际 DOM 结构 -->
<!--fragment-start-->
<tr>...</tr>
<tr>...</tr>
<tr>...</tr>
<!--fragment-end-->
```

用两个 `Comment` 节点（`<!--fragment-start-->` 和 `<!--fragment-end-->`）框定 Fragment 内容的范围。

### 7.3 bindRender 中的 Fragment 处理

#### 首次渲染

```ts
if (!startAnchor || !endAnchor) {
  // 1. 创建两个锚点注释节点
  startAnchor = document.createComment("fragment-start");
  endAnchor = document.createComment("fragment-end");

  // 2. 用 startAnchor 替换原始占位元素
  currentEl.replaceWith(startAnchor);
  startAnchor.after(endAnchor);

  // 3. 将 Fragment 的子节点插入到两个锚点之间
  for (const child of newChildren) {
    parent.insertBefore(child, endAnchor);
  }
}
```

#### 后续更新

```ts
else {
  // 1. 收集 startAnchor 和 endAnchor 之间的所有旧子节点
  const oldChildren = [];
  let current = startAnchor.nextSibling;
  while (current && current !== endAnchor) {
    oldChildren.push(current);
    current = current.nextSibling;
  }

  // 2. 根据是否有 key 选择 diff 策略
  if (hasKeyedChildren(newChildren)) {
    patchKeyedChildren(parent, oldChildren, newChildren, endAnchor);
  } else {
    // index-based diff...
  }
}
```

#### Tracker Element（跟踪代理）

锚点是 `Comment` 节点不是 `Element`，但 `compileElement` 需要 `Element` 类型的 `currentEl` 来做下一轮更新。解决方案：

```ts
function findTrackerElement(parent, start, end) {
  // 在锚点之间找第一个 Element 作为 tracker
  let current = start.nextSibling;
  while (current && current !== end) {
    if (current instanceof Element) return current;
    current = current.nextSibling;
  }
  // 找不到就创建一个隐藏的 span
  const placeholder = document.createElement("span");
  placeholder.style.display = "none";
  parent.insertBefore(placeholder, end);
  return placeholder;
}
```

找到 tracker 后，将锚点引用挂载到其上，确保下一轮更新时能重新找到锚点：

```ts
const trackerEl = findTrackerElement(parent, startAnchor, endAnchor);
trackerEl._fragmentStartAnchor = startAnchor;
trackerEl._fragmentEndAnchor = endAnchor;
return trackerEl;  // 返回给 compileElement 的 currentEl
```

---

## 8. 完整渲染流程示例

以下用一个具体的列表渲染例子，串联整个流程：

### 源代码

```tsx
const studentList = reactive([
  { id: 1, name: '张三' },
  { id: 2, name: '李四' },
]);

export function Home() {
  return (
    <>
      {studentList.map(s => (
        <tr key={s.id}><td>{s.name}</td></tr>
      ))}
    </>
  );
}
```

### 首次渲染流程

```
1. esbuild 编译 JSX：
   jsx(Fragment, { children: studentList.map(s =>
     jsx("tr", { children: jsx("td", { children: s.name }) }, s.id)
   )})

2. jsx() 函数：
   - Fragment → 调用 Fragment(props)
   - "tr" → 将 key=s.id 合并到 props，调用 createElement("tr", {key: s.id, ...})

3. createElement()：
   - 创建 <tr> 元素
   - props.key=1 → tr._key = 1（不设为 attribute）
   - 递归创建 <td>，appendChildren 添加文本节点

4. Fragment() 返回 DocumentFragment 包含两个 <tr>

5. compile → bindRender → result 是 DocumentFragment：
   - 首次渲染：创建 <!--fragment-start--> 和 <!--fragment-end-->
   - 将 <tr> 节点插入锚点之间
   - 响应式系统在访问 studentList 时，自动收集 updateFn 为依赖

6. DOM 结果：
   <!--fragment-start-->
   <tr><td>张三</td></tr>     ← _key = 1
   <tr><td>李四</td></tr>     ← _key = 2
   <!--fragment-end-->
```

### 更新流程（头部插入 `{ id: 3, name: '王五' }`）

```
1. studentList.unshift({ id: 3, name: '王五' })
   → Proxy.set 拦截 → eventBus.publish()

2. eventBus 通知 updateFn 重新执行
   → bindRender(currentEl, render)

3. render() 重新执行，JSX 工厂生成新 DOM：
   Fragment 包含 3 个 <tr>（_key 分别为 3, 1, 2）

4. bindRender 检测到 startAnchor/endAnchor 已存在 → 进入更新分支

5. 收集锚点间旧节点：[tr(_key=1), tr(_key=2)]

6. hasKeyedChildren(newChildren) = true → patchKeyedChildren()

7. Keyed diff 执行：
   oldKeyMap: { 1 → tr旧1, 2 → tr旧2 }

   新 _key=3 → map 中找不到 → 使用新 <tr>
   新 _key=1 → 找到 tr旧1 → diff(tr旧1, tr新1)，复用
   新 _key=2 → 找到 tr旧2 → diff(tr旧2, tr新2)，复用

   删除：无需删除
   调整顺序：insertBefore 将节点按 [3, 1, 2] 排列

8. DOM 结果：
   <!--fragment-start-->
   <tr><td>王五</td></tr>     ← 新建
   <tr><td>张三</td></tr>     ← 复用旧 DOM（input 状态保留）
   <tr><td>李四</td></tr>     ← 复用旧 DOM（input 状态保留）
   <!--fragment-end-->
```

---

## 附录：关键数据结构

### element._key

```ts
// JSX 工厂中设置
(element as any)._key = value;  // 不设为 HTML attribute

// diff 中读取
function getKey(node: Node): any {
  return (node as any)._key;
}
```

### element._listeners

```ts
// JSX 工厂中记录
(element as any)._listeners = { click: handler, input: handler2 };

// diff 中用于事件比较和更新
```

### element._fragmentStartAnchor / _fragmentEndAnchor

```ts
// bindRender 中设置
(trackerEl as any)._fragmentStartAnchor = startAnchor;   // Comment 节点
(trackerEl as any)._fragmentEndAnchor = endAnchor;         // Comment 节点

// 下一轮 bindRender 中读取，定位 Fragment 范围
```
