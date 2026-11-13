# @actview/core

ActView 核心包：组件类型、装饰器、运行时与 DOM 渲染器、内置组件。

## 内容

```text
src/
  types/        Element / ClassComponent / BuiltinComponent / ComponentProps / VNode 类型
  runtime/      createApp / mountClassComponent / installReactiveApi / installLifecycle / patch
  lifecycle/    currentInstance + onXxx + invokeHooks
  decorator/    @Component / @Model / @Prop / @Ref / @Reactive / @Computed / @Watch / @Provide / @Inject / @UseModel
  components/   KeepAlive / Suspense / ErrorBoundary / Teleport / Transition / TransitionGroup / Dynamic
```

## 对外 API

从 `@actview/core`（或用户入口 `actview`）使用：

- `createApp` / `nextTick` / `app.use` / `app.onUnmount`；
- `ActViewComponent` 与全部装饰器；
- `Model` / `UseModel`（组件内数据层）；
- `KeepAlive` / `Suspense` / `lazy`（loading/error/retry/timeout）/ `ErrorBoundary` / `Teleport` / `Transition` / `TransitionGroup` / `Dynamic`；
- 公开类型：`Element` / `ClassComponent` / `BuiltinComponent` / `ComponentProps`。

`@actview/core/internal` 仅供内部/测试使用（VNode / ClassComponentCtor / ComponentInternalInstance）。

## 开发

```bash
pnpm -C packages/core typecheck
pnpm -C packages/core build       # tsup ESM + d.ts
```

设计文档：[architecture.md](../../docs/architecture.md)、[renderer.md](../../docs/renderer.md)、[decorators.md](../../docs/decorators.md)。
