# component-jsx — 组件 + JSX + 事件

**难度**：medium ｜ **标签**：component / jsx / event

## 题目

实现一个带按钮的计数器组件，**用 ref + JSX + 事件**：

```
Counter() → 渲染：
  <p data-testid="count">count: {count}</p>
  <button data-testid="inc">+1</button>
```

要求：

- `count` 用 `ref(0)` 维护
- 点击 `+1` 按钮后 `count` 加一，视图同步更新

## 掌握点

- 组件函数体 = setup（只跑一次），`return JSX` 被框架包装为 render 函数
- JSX 里用 `{expr}` 插值，`onClick` 绑定事件
- ref 在 JSX 中读取用 `.value`

## 模板

见 `solution.tsx`，补全 `Counter` 组件即可。

## 运行

```bash
pnpm challenge run component-jsx
```
