# actview

ActView 用户聚合入口（薄壳）：只导出应用开发所需的 API。

## 安装

```bash
pnpm add actview
```

## 快速开始

```tsx
import {
  ActViewComponent,
  Component,
  Ref,
  Setup,
  createApp,
} from 'actview'

@Component({ name: 'Counter' })
class Counter extends ActViewComponent {
  @Ref count = 0

  @Setup
  setup() {
    this.count = 0
  }

  render() {
    return <button onClick={() => this.count++}>{this.count}</button>
  }
}

createApp(Counter).mount('#app')
```

## 导出范围

- `createApp` / `App`；
- `ActViewComponent` 与全部类组件装饰器（`@Component` / `@Prop` / `@Ref` / `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` / 生命周期）；
- 组件内数据层：`@Model` + `@UseModel(Token)`；
- 内置组件：`KeepAlive` / `Suspense` / `lazy` / `ErrorBoundary` / `Teleport` / `Transition`；
- 公开类型：`Element` / `ClassComponent` / `BuiltinComponent` / `ComponentProps` / `ElementType` 等。

**不导出**：`ref` / `reactive` / `effect` / `computed` / `watch` / `provide` / `inject` / `getCurrentInstance` 等运行时内部 API。

## 配置

`tsconfig` 需要：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@actview/jsx"
  }
}
```

## 开发

```bash
pnpm -C packages/actview typecheck
pnpm -C packages/actview build
```

文档：[architecture.md](../../docs/architecture.md)、[decorators.md](../../docs/decorators.md)。
