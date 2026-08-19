# reactivity-computed — computed 派生值

**难度**：easy ｜ **标签**：reactivity / computed

## 题目

用框架的 `computed` 实现一个派生值：

```
useDouble(source: Ref<number>) → Ref<number>
```

要求：

- 返回一个 **computed ref**，值是 `source.value` 的两倍
- `source` 变化后，返回的 ref **自动重算**（响应式派生，而非一次性快照）

## 掌握点

- `computed(getter)` 创建惰性派生的响应式值
- 派生值随依赖源自动更新 —— 这是响应式框架的核心心智模型

## 模板

见 `solution.tsx`，补全 `useDouble` 实现即可。

## 运行

```bash
pnpm challenge run reactivity-computed
```
