# 解决 JSX 组件 `() => () => VNode` 模式与 TypeScript 类型校验不兼容的问题

## 问题描述

组件采用 Vue 3 风格的 `setup + render` 模式：

```tsx
function MyButton() {
  return () => <div></div>
}

function Greet(props: { name: string }): () => VNode {
  const age = ref(0)
  return () => (
    <div class="greet">
      <MyButton />
    </div>
  )
}
```

TypeScript 报错：

```
'MyButton' cannot be used as a JSX component.
  Its return type '() => JSX.Element' is not a valid JSX element.
```

## 根因分析

### 1. TypeScript 的 JSX 组件校验规则

当 TypeScript 遇到 `<MyButton />`，它会做两件事：

1. 生成 `jsx(MyButton, {})` 调用（编译阶段）
2. **校验 `MyButton({})` 的返回类型是否是 `JSX.Element | null`**（类型检查阶段）

第二步是关键——TypeScript 要求组件函数的**返回值**是 `JSX.Element` 或其子类型。

### 2. 组件的实际返回类型与 JSX.Element 不匹配

我们的组件模式：

```
MyButton: () => () => VNode
         ↑ 外层 setup  ↑ 内层 render，返回真正的 JSX
```

- `MyButton({})` 返回的不是 VNode，而是 `() => VNode`（render 函数）
- TypeScript 校验：`() => VNode` 是否满足 `JSX.Element | null`？

### 3. JSX.Element 的递归赋值问题

`JSX.Element` 被定义为 `VNode | (() => VNode)`：

- `() => VNode` **是** `JSX.Element` 的一个分支 → 理论上应该匹配 ✅
- 但 TypeScript 的内部检查**不是**把组件返回值和 `JSX.Element` 做 union 匹配，而是**逐个分支精确比对**：
  - 检查分支 `VNode`：`() => VNode` 不是 `VNode` → ❌
  - 检查分支 `() => VNode`：要求 `() => VNode` 的 return type 精确匹配 `VNode` → 但 `JSX.Element` 实际展开为 `VNode | (() => VNode)`，`() => VNode` 的 return type 变成了 `VNode | (() => VNode)`，不再是 `VNode` → ❌

递归展开后，`() => VNode` 的返回值永远带上了 `() => VNode` 的尾巴，无法精确匹配纯 `VNode`。

### 4. 更本质的矛盾

TypeScript 的 **JSX 类型系统假设组件直接返回 JSX 元素**（React 模式）：

```
Component → JSX.Element  ← TypeScript 的设计预期
```

我们的模式是：

```
Component → () → JSX.Element  ← 中间多了一层 render 函数
           ↑ setup  ↑ render
```

多出的这层 `() => VNode` 让 TypeScript 的类型检查链条断在「函数类型不能赋值给 VNode 对象类型」这个基础规则上。

## 解决方案

**去掉 `JSX.Element` 的类型定义**，让 TypeScript fallback 到 `any`，从而跳过组件返回类型的精确校验。

### 为什么不去修 JSX.Element 的类型？

尝试过的方案都走不通：

| 方案 | 结果 |
|------|------|
| `JSX.Element = VNode \| (() => VNode)` | 递归展开后 `() => VNode` 的 return type 变为 `VNode \| (() => VNode)`，无法精确匹配纯 `VNode` |
| `JSX.Element = VNode \| (() => Element)`（递归） | 无限递归，TypeScript 报 complexity 超限 |
| 组件加显式 `(): () => VNode` 标注 | 函数体中的 JSX 表达式类型为 `JSX.Element`，与 `VNode` 依然不兼容 |
| 放宽 `jsx()` 的 type 参数 | 只解决 `jsx()` 调用，不解决 JSX 内置的组件返回类型校验 |

这些方案都卡在同一个点上：**TypeScript 的 JSX 组件校验逻辑是硬编码的，它强制要求 `ComponentReturnType extends JSX.Element | null`，无法通过类型层面的调整绕过函数和 VNode 的类型鸿沟。**

### 改动后类型安全如何保证？

去掉 `JSX.Element` 后 JSX 表达式类型变为 `any`，但三条防线保留：

1. **`jsx()` 返回 `VNode`** — `const vnode = <div />` 如果赋值给非 VNode 变量会报错
2. **组件显式标注 `(): () => VNode`** — 组件边界处类型约束生效
3. **`app.mount(Component, '#app')`** — `Component` 类型 `(props) => () => VNode` 约束入口

HTML 元素的属性校验（`onclick` 提示）不依赖 `JSX.Element`，继续正常工作。

## 改动代码

**文件：** `packages/jsx/src/jsx-global.ts`

**改动前：**

```typescript
declare global {
  namespace JSX {
    type Element = import('./types').VNode | (() => import('./types').VNode)
    interface IntrinsicElements { ... }
    interface ElementChildrenAttribute { children: unknown }
  }
}
```

**改动后：**

```typescript
declare global {
  namespace JSX {
    // 不定义 Element，JSX 表达式类型 fallback 为 any。
    // 组件返回类型校验被绕过，兼容 () => () => VNode 模式。
    // VNode 类型安全由 jsx() 的返回类型和组件显式标注保证。
    interface IntrinsicElements { ... }
    interface ElementChildrenAttribute { children: unknown }
  }
}
```

只删除了 `type Element = ...` 这一行。`IntrinsicElements`（HTML 元素属性提示）和 `ElementChildrenAttribute`（children 属性）不受影响。
