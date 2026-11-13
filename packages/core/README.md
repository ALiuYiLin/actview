# @actview/core

ActView 核心包：组件类型、装饰器、运行时与 DOM 渲染器、内置组件。

## 内容

```text
src/
  types/        Element / ClassComponent / BuiltinComponent / ComponentProps / VNode 类型
  runtime/      createApp / mountClassComponent / installReactiveApi / installLifecycle / patch
  lifecycle/    currentInstance + onXxx + invokeHooks
  decorator/    @Component / @Prop / @Ref / @Reactive / @Computed / @Watch / @Provide / @Inject
  components/   KeepAlive / Suspense / ErrorBoundary / Teleport / Transition
```

## 对外 API

从 `@actview/core`（或用户入口 `actview`）使用：

- `createApp` / `nextTick`；
- `ActViewComponent` 与全部装饰器；
- `KeepAlive` / `Suspense` / `lazy` / `ErrorBoundary` / `Teleport` / `Transition`；
- 公开类型：`Element` / `ClassComponent` / `BuiltinComponent` / `ComponentProps`。

`@actview/core/internal` 仅供内部/测试使用（VNode / ClassComponentCtor / ComponentInternalInstance）。

## 开发

```bash
pnpm -C packages/core typecheck
pnpm -C packages/core build       # tsup ESM + d.ts
```

设计文档：[architecture.md](../../docs/architecture.md)、[renderer.md](../../docs/renderer.md)、[decorators.md](../../docs/decorators.md)。
