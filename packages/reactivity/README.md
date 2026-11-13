# @actview/reactivity

ActView 的响应式系统。**派生自 [`@vue/reactivity`](https://github.com/vuejs/core/tree/main/packages/reactivity) 3.5.39**（MIT，版权与许可见 [LICENSE](./LICENSE)）。

## 为什么复用 Vue 的响应式

响应式（`ref` / `reactive` / `computed` / `effect` / `effectScope` / `watch`）与视图层无关：它不依赖 JSX、不依赖 `.vue` 单文件组件、也不依赖组件运行时。ActView 的渲染模型（`@Component` 类 + render effect 驱动组件级 re-render）在响应式依赖收集层面与 Vue 3 一致，因此这一层可以**原样复用**，只做包名与编译期常量的适配。

## 相对上游的改动（保持最小，便于跟随 Vue 升级）

| 改动 | 原因 |
|---|---|
| `@vue/shared` → `@actview/shared` | workspace 包名 |
| `warn` 前缀 `[Vue warn]` → `[ActView warn]` | 用户可见文案 |
| 两处内部提示文案中的 `Vue` → `ActView` | 用户可见文案 |
| 编译期常量 `__DEV__` 由消费方 `define` 注入 | 见下 |

源码逻辑本身**未改动**（`reactive.ts` / `effect.ts` / `dep.ts` / `ref.ts` / `computed.ts` / `watch.ts` / `effectScope.ts` / 集合与数组处理器）。

## 编译期常量

Vue 源码使用 `__DEV__`（声明见 `packages/global.d.ts`）。三种消费方式：

- **本包构建**（tsup）：`define.__DEV__ = process.env.NODE_ENV !== "production"`，产物中由下游 bundler 折叠。
- **直接消费源码**（workspace dev / vite）：宿主需 `define: { __DEV__: 'true' }`（或 `process.env.NODE_ENV !== 'production'`）。
- **测试**（vitest）：`vitest.config.ts` 已注入 `__DEV__: 'true'`。

## 用法

```ts
import { ref, computed, reactive, effect, effectScope, watch } from '@actview/reactivity'

const count = ref(0)
const double = computed(() => count.value * 2)

effect(() => console.log(double.value))
count.value++ // 2
```

## 开发

```bash
pnpm --filter @actview/reactivity typecheck   # tsc --noEmit
pnpm --filter @actview/reactivity test        # vitest（上游 3.5.39 测试套件移植）
pnpm --filter @actview/reactivity build       # tsup → dist（ESM + d.ts）
```

### 测试

`__tests__/` 移植自 Vue 3.5.39 的 `packages/reactivity/__tests__`，仅做导入路径适配。组件运行时集成用例由 `@actview/core` 覆盖；本包测试只覆盖响应式层。
