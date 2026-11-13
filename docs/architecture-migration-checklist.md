# 架构对齐清单（实施结果）

> 目标来源：飞书思维笔记 Actview（packages / reactivity / jsx / shared / core{lifecycle,runtime,decorator,components}）。
> 本文记录第一轮架构实施结果与剩余项。

## 已完成

| 项 | 结果 |
|---|---|
| `runtime-core` 合并 | 删除 `@actview/runtime-core`；Element/ClassComponent/VNode/createElement/isComponent 移入 `@actview/core`（`types/` + `runtime/`） |
| `compiler` 删除 | 删除 `@actview/compiler` 包；Babel 保留为根 devDependency；Vite 无 compiler 插件 |
| `core/lifecycle` | `core/src/lifecycle/index.ts`（全部 hooks） |
| `core/runtime` | `mountComponent.ts`、`installReactiveApi.ts`、`installLifecycle.ts`、`component.ts`、`app.ts`、`instance.ts`、`scheduler.ts`、`patch/` |
| `core/decorator` | `meta.ts` / `component.ts`（@Component + ActViewComponent）/ `reactive.ts` / `lifecycle.ts` / `index.ts` |
| `core/components` | KeepAlive / Suspense / ErrorBoundary / Teleport / Transition |
| `actview` 聚合入口 | 只导出用户 API：createApp、装饰器、内置组件、公开类型；不导出 ref/reactive/effect 等内部函数 |
| `jsx` 依赖方向 | `jsx → core`（仅公开类型 + createElement/Fragment） |
| 测试 | `core/__tests__` 全部迁移；runtime-core 测试/type-tests 迁入 core；全仓 397 passed / 4 skipped |
| 配置 | root references / typecheck / build:packages / vite aliases / pnpm workspace 已更新 |

## 保留的合理内聚 / 剩余项

1. **patch 拆分**：`patchProps.ts` 已独立；`patchComponent` / `patchElement` 逻辑仍在 `runtime/patch/index.ts`（与 children diff、unmount、keepalive 强耦合）。当前按“合理拆分”保留内聚，后续可单独重构。
2. **`jsx-dev`**：实现保留 `jsx-dev-runtime` 子路径（TS/构建约定），思维笔记中的 `jsx-dev` 视为概念节点。
3. **`ActViewComponent` / `ComponentMeta`**：放在 `core/decorator`（meta.ts/component.ts）；运行时 `installReactiveApi` 只消费元数据。
4. **components 范围**：包含思维笔记未列的 `ErrorBoundary`、`lazy`（lazy 由 Suspense 模块导出）。
5. **文档**：`types-architecture.md` / `compiler-layers.md` 已按新结构重写；`renderer-design.md` 关键路径已同步（部分历史段落仍引用旧文件，后续清理）。

## 决策记录（已拍板）

- runtime-core 合并进 core；
- compiler 删除；
- 生命周期保留全部 hooks；
- ComponentMeta / ActViewComponent 放 decorator 层；
- components 包含现有全部内置组件；
- actview 只 re-export 用户面向 API；
- patch 按当前合理粒度拆分（props 独立，component/element 暂内聚）。

## 验收

- `pnpm typecheck` ✅
- `pnpm test` ✅ 397 passed / 4 skipped
- `pnpm build` ✅
- `pnpm build:packages` ✅
