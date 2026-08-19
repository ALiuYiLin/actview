# reactivity-ref — ref 基础

**难度**：easy ｜ **标签**：reactivity / ref

## 题目

用框架的 `ref` 实现一个响应式计数器：

```
useCounter(initial) → { count: Ref<number>, increment: () => void }
```

要求：

- `count` 必须是框架的 **ref**（响应式，直接改 `count.value` 生效）
- `increment()` 使 `count.value + 1`

## 掌握点

- `ref()` 创建响应式引用，`.value` 读写
- 返回 ref 而非普通对象 —— 组件/派生逻辑才能追踪到变化

## 模板

见 `solution.tsx`，补全 `useCounter` 实现即可。

## 运行

```bash
pnpm challenge run reactivity-ref
```
