# reactivity-watch-effect — watchEffect 依赖追踪

**难度**：medium ｜ **标签**：reactivity / watchEffect

## 题目

用框架的 `watchEffect` 实现一个变化日志：

```
useLogger(source: Ref<number>) → { log: Ref<number[]> }
```

要求：

- `watchEffect` 追踪 `source`，**首次立即执行**，把初始值 push 进 `log`
- 之后每次 `source` 变化，把新值 push 进 `log`

期望行为：

```
source = ref(1) → log = [1]
source.value = 2 → log = [1, 2]
```

## 掌握点

- `watchEffect(fn)`：立即执行一次收集依赖，依赖变化后异步触发
- 副作用应写在回调内（读 `source.value` 才会被追踪）

## 模板

见 `solution.tsx`，补全 `useLogger` 实现即可。

## 运行

```bash
pnpm challenge run reactivity-watch-effect
```
