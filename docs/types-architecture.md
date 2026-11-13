# ActView 类型与包分层（类组件 + core 内聚架构）

> 当前架构：`runtime-core` 已合并进 `@actview/core`，`compiler` 已删除；
> 用户入口为 `actview`（薄壳聚合）。设计背景见 [class-component-design.md](./class-component-design.md)。

## 1. 包职责

| 包 | 职责 | 入口 | 关键 API |
|---|---|---|---|
| `actview` | 面向用户的薄壳聚合导出 | `.` | `createApp` / `App` / `ActViewComponent` / 全部类组件装饰器 / 内置组件 / 公开类型 |
| `@actview/core` | 平台无关类型 + DOM 渲染器 + 装饰器 + 内置组件 | `.` / `./internal` | `Element` / `ClassComponent` / `BuiltinComponent` / `ComponentProps` / `createApp` / 装饰器 / `Suspense` / `KeepAlive` / `Teleport` / `Transition` |
| `@actview/jsx` | JSX 作者层：全局 `JSX` 命名空间、DOM/SVG 属性类型、automatic runtime | `.` / `./jsx-runtime` / `./jsx-dev-runtime` | `jsx` / `jsxs` / `jsxDEV` / `Fragment`；再导出 core 公开类型 |
| `@actview/reactivity` | 响应式系统（内部） | `.` | `ref` / `reactive` / `computed` / `effect` / `watch`；供 core 内部使用，**不进入用户聚合入口** |
| `@actview/shared` | 内部共享工具 | — | 不对外 |

依赖方向：

```
reactivity → shared
core → reactivity, shared
jsx → core（公开类型与 createElement/Fragment）
actview → core（用户 API 聚合）
```

## 2. `@actview/core` 目录

```text
packages/core/src/
  index.ts                  公开入口（装饰器 / 内置组件 / createApp / 类型）
  internal.ts               内部类型入口（VNode / ClassComponentCtor / createVNode…）
  types/
    element.ts              Element / ElementType / ClassComponent / BuiltinComponent / ComponentProps
    component.ts            RenderFunction / ClassComponentCtor / isClassComponent / isComponent
  runtime/
    app.ts                  createApp / mount / unmount
    mountComponent.ts       mountClassComponent（构造 → 安装 → @Setup → render）
    installReactiveApi.ts   @Prop/@Ref/@Reactive/@Computed/@Inject/@Provide/@Watch 安装
    installLifecycle.ts     生命周期装饰器 → hooks 数组
    component.ts            实例创建 / props / renderComponentRoot / shouldUpdate
    instance.ts             ComponentInternalInstance / public instance 类型
    scheduler.ts            微任务调度 / nextTick
    patch/                  patch 调度 + children diff + component/element/unmount
      index.ts              render / patch 分派 / component+element 逻辑
      patchProps.ts         DOM property / class / style / 事件
    vnode.ts / vnodeFactory.ts
    hostNodes.ts / refs.ts / apiProvide.ts / errorHandling.ts / devtools.ts
  lifecycle/
    index.ts                currentInstance + onXxx + invokeHooks
  decorator/
    index.ts                统一出口
    meta.ts                 元数据存储 / 类型 / 合并
    component.ts            @Component + ActViewComponent
    reactive.ts             @Prop/@Ref/@Reactive/@Computed/@Watch/@Provide/@Inject
    lifecycle.ts            @Setup + 生命周期装饰器
  components/
    KeepAlive.ts / Suspense.ts / ErrorBoundary.ts / Teleport.ts / Transition.ts
```

## 3. 组件模型

```tsx
@Component({ name: 'Counter' })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop initial = 1
  @Ref count = 0
  @Reactive user = { name: 'Ada' }
  @Computed get double() { return this.count * 2 }
  @Watch('count') onCount(value: number) {}

  @Setup setup() { this.count = this.initial }
  @Mounted mounted() {}
  @Unmounted unmounted() {}

  render() {
    return <button onClick={() => this.count++}>{this.count}/{this.double}</button>
  }
}
```

- 组件 = 带 `__actview_class_component` 标记的 class 构造器（`@Component` 强制）；
- `@Prop` 映射 `instance.props`，initializer 为缺省值；
- `@Ref` 装饰器记录元数据，`mountClassComponent` 在构造后安装每实例 accessor（`this.count` 是 number，内部 ref）；
- `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` 由 `installReactiveApi` 安装；
- `@Setup` 只执行一次；生命周期由 `installLifecycle` 注册到 hooks。

## 4. 验证

```bash
pnpm typecheck       # 根 app + 5 包 + type-tests
pnpm test            # 397 passed / 4 skipped
pnpm build           # tsc -b + vite build
pnpm build:packages  # tsup 各包（含 d.ts）
```

## 5. 已知边界 / 后续

- `patch/ELEMENT` 与 `patch/COMPONENT` 逻辑目前仍在 `runtime/patch/index.ts` 内聚（与 children diff/卸载强耦合）；`patchProps` 已独立。后续如需可拆为 `patchComponent.ts` / `patchElement.ts`。
- `actview` 只导出用户 API：`createApp`、装饰器、内置组件、公开类型；不导出 `ref`/`reactive`/`effect`/`provide`/`inject`/`getCurrentInstance` 等运行时内部 API。
- `@actview/jsx` 的 `jsx-dev-runtime` 子路径按 TS/构建约定保留（思维笔记里的 `jsx-dev` 视为概念节点）。
- 类组件 / 装饰器 / 内置组件 / 渲染器测试保持通过；HMR/SSR/静态分析仍属后续。
