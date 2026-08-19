# props-use-prop — 用 useProps 响应式读取 props

**难度**：medium ｜ **标签**：component / props / reactivity

## 题目

实现一个 `Counter` 组件，**用框架的 `useProps` 读取 props**：

```
Counter(props) → 渲染 <p data-testid="count">count: {count}</p>
```

要求：

- 用 `useProps(props, { count: ... })` 读取 `props.count`（未传入时默认 `0`）
- **父组件更新 `count` prop 后，视图必须同步更新**

> 关键点：直接在 setup 里解构 `const { count } = props` 会丢失响应性 ——
> 父组件更新 prop 后视图不会变化。这道题就是考这一点。

## 掌握点

- `useProps` 返回响应式取值（ComputedRef），父组件改 prop 自动触发重渲染
- setup 阶段对 props 做快照（解构/直接读）会丢失响应性

## 模板

见 `solution.tsx`，补全 `Counter` 组件即可。

## 运行

```bash
pnpm challenge run props-use-prop
```
