# ActView 架构

> 当前实现：类组件 + 装饰器；`@actview/runtime-core` 已并入 `@actview/core`，`@actview/compiler` 已删除。
> 相关文档：[装饰器](./decorators.md) · [渲染器](./renderer.md) · [构建链](./build.md)

## 1. 包结构

```text
packages/
  actview/          用户聚合入口（薄壳，只导出用户 API）
  core/             类型 + DOM 渲染器 + 装饰器 + 内置组件
  devtools/         DevTools backend（树 / 状态 / 事件 / 性能；无 UI）
  router/           路由（RouterView/RouterLink、guards、history）
  jsx/              JSX 作者层（全局 JSX 类型 / jsx-runtime / jsx-dev-runtime）
  reactivity/       响应式系统（core 内部使用）
  shared/           内部共享工具
extensions/
  devtools/         Chrome DevTools 扩展（面板 UI 用 ActView 实现）
playground/
  actview/          私有示例应用（不发布）
```

| 包 | 职责 | 入口 |
|---|---|---|
| `actview` | 用户 API：`createApp` / `nextTick` / App 插件类型 / `ActViewComponent` / 全部装饰器 / 内置组件 / 公开类型 | `.` |
| `@actview/core` | 组件类型、装饰器、运行时、DOM 渲染器、内置组件 | `.` / `./internal` |
| `@actview/devtools` | DevTools backend + 页面 bridge；Chrome 扩展在 `extensions/devtools` | `.` |
| `@actview/router` | 路由：history / 嵌套路由 / guards / RouterView、RouterLink | `.` |
| `@actview/jsx` | 全局 JSX 命名空间、DOM/SVG 属性类型、automatic runtime | `.` / `./jsx-runtime` / `./jsx-dev-runtime` |
| `@actview/reactivity` | `ref` / `reactive` / `computed` / `effect` / `watch` | `.`（内部使用） |
| `@actview/shared` | 内部工具函数 | `.`（内部使用） |

依赖方向：

```text
reactivity → shared
core → reactivity, shared
devtools → core
devtools extension → @actview/devtools bridge（postMessage / chrome.runtime）
router → core, reactivity
jsx → core（公开类型 + createElement/Fragment）
actview → core（用户 API 聚合）
playground/actview → actview
```

**公开边界**：`actview` 不导出 `ref` / `reactive` / `effect` / `computed` / `watch` / `provide` / `inject` / `getCurrentInstance` 等运行时内部 API；用户只通过装饰器使用状态与注入。

## 2. `@actview/core` 目录

```text
packages/core/src/
  index.ts                    公开入口
  internal.ts                 内部类型入口（VNode / ClassComponentCtor / createVNode）
  types/
    element.ts                Element / ElementType / ClassComponent / BuiltinComponent / ComponentProps
    component.ts              RenderFunction / ClassComponentCtor / isClassComponent / isComponent
  runtime/
    app.ts                    createApp / mount / unmount / use / onUnmount
    mountComponent.ts         mountClassComponent：构造 → 安装 → @Setup → render
    componentScope.ts         组件内 Model 作用域（@UseModel 单实例 / 生命周期排序）
    installReactiveApi.ts     @Prop/@Ref/@Reactive/@Computed/@Inject/@Provide/@Watch 安装
    installLifecycle.ts       生命周期装饰器 → hooks
    component.ts              实例创建 / props / renderComponentRoot / shouldUpdate
    instance.ts               ComponentInternalInstance / ComponentPublicInstance
    scheduler.ts              queueJob / nextTick / post flush
    patch/
      index.ts                render / patch 分派 / children diff / component+element
      patchProps.ts           DOM property / class / style / 事件
    vnode.ts / vnodeFactory.ts
    hostNodes.ts / refs.ts / apiProvide.ts / errorHandling.ts / devtools.ts
  lifecycle/index.ts          currentInstance / onXxx / invokeHooks
  decorator/
    index.ts                  统一出口
    meta.ts                   元数据存储 / 类型 / 合并
    component.ts              @Component + ActViewComponent
    model.ts                  @Model + @UseModel（组件内数据层）
    reactive.ts               @Prop/@Ref/@Reactive/@Computed/@Watch/@Provide/@Inject
    lifecycle.ts              @Setup + 生命周期装饰器
  components/
    KeepAlive.ts / Suspense.ts / AsyncComponent.ts / ErrorBoundary.ts
    Teleport.ts / Transition.ts / TransitionGroup.ts（含 Dynamic）
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

  render() {
    return <button onClick={() => this.count++}>{this.count}/{this.double}</button>
  }
}
```

- 组件 = 带 `__actview_class_component` 标记的 class 构造器（`@Component` 强制）；
- `render()` 必须实现；JSX 标签类型由 `ClassComponent` / `ComponentProps` 支持；
- `@Ref` 在渲染器构造实例后安装每实例 accessor，`this.count` 类型为 `number`；
- 数据层可以用 `@Model` + `@UseModel(Token)` 拆出，见 [dependency-injection.md](./dependency-injection.md)；
- 完整 API 与安装顺序见 [decorators.md](./decorators.md)。

## 4. 类型与公开边界

- 公开：`Element`（4 个稳定字段）、`ElementType`、`ClassComponent`、`BuiltinComponent`、`ComponentProps`、`RenderFunction`；
- 内部：`VNode` / `ClassComponentCtor` / `ComponentInternalInstance` / `createVNode`，只经 `@actview/core/internal` 使用；
- 渲染器实现类型（`ctx` / hooks / scheduler）留在 `core/runtime/instance.ts`，不进入公开入口。

## 5. 验证命令

```bash
pnpm dev            # playground/actview
pnpm build          # playground 类型检查 + vite build
pnpm test           # reactivity + core 测试
pnpm typecheck      # 7 包 + playground
pnpm build:packages # 各包 tsup + d.ts
```

## 6. 当前边界

- 未实现 HMR / SSR / hydrate / 静态分析 / 代码生成；
- 组件组合采用 props（组件构造器 / render function / children），不做 slots；
- 组件 ref 使用显式 `ref={(el) => ...}` callback，不做 `defineExpose`；
- 组件 emits / `$attrs` / `$emit` 尚未补齐；
- App 插件契约已实现（`app.use` / `app.onUnmount` / `app.config`），官方插件与 `app.component` / `app.directive` 尚未实现，见 [plugins.md](./plugins.md)；
- `patchComponent` / `patchElement` 逻辑仍在 `runtime/patch/index.ts`（与 children diff/unmount/KeepAlive 强耦合），`patchProps` 已独立；
- 装饰器为 legacy（`experimentalDecorators`），Stage-3 迁移后续处理。

完整缺口与优先级见 [roadmap.md](./roadmap.md)。
