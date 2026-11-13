# ActView

ActView 是一个 **类组件 + 装饰器** 的响应式前端框架：

- 组件 = `@Component` 类，必须实现 `render()`；
- `@Ref` / `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` 声明状态与依赖；
- `@Model` + `@UseModel(Token)` 支持组件内数据层拆分（per-component 单实例）；
- 渲染器采用组件级 re-render（render effect + 微任务调度），DOM diff 支持 keyed + LIS；
- JSX 由宿主的 automatic runtime 降级（`jsxImportSource: @actview/jsx`），无编译期组件包装。

## 目录

```text
packages/
  actview/          用户聚合入口（createApp / 装饰器 / 内置组件）
  core/             类型 + DOM 渲染器 + 装饰器 + 内置组件
  devtools/         DevTools backend（无 UI）
  jsx/              JSX 作者层（全局 JSX 类型 / jsx automatic runtime）
  reactivity/       响应式系统（core 内部使用）
  shared/           内部共享工具
playground/
  actview/          私有示例应用（playground，不发布）
```

## 快速开始

```bash
pnpm install
pnpm dev            # 启动 playground/actview
pnpm build          # 构建 playground 应用
pnpm test           # reactivity + core 测试
pnpm typecheck      # 全部包 + playground 类型检查
```

## 组件示例

```tsx
import {
  ActViewComponent,
  Component,
  Computed,
  Prop,
  Ref,
  Setup,
  Mounted,
} from 'actview'

@Component({ name: 'Counter' })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop initial = 0
  @Ref count = 0

  @Setup
  setup(): void {
    this.count = this.initial
  }

  @Computed
  get double(): number {
    return this.count * 2
  }

  @Mounted
  mounted(): void {
    console.log('mounted')
  }

  render() {
    return (
      <button onClick={() => this.count++}>
        {this.count} / {this.double}
      </button>
    )
  }
}
```

## 文档

- [docs/architecture.md](docs/architecture.md) — 包结构、目录、公开边界
- [docs/decorators.md](docs/decorators.md) — 类组件与全部装饰器
- [docs/dependency-injection.md](docs/dependency-injection.md) — 组件内 Model / @UseModel
- [docs/plugins.md](docs/plugins.md) — App 插件契约与官方插件规划
- [docs/renderer.md](docs/renderer.md) — 渲染器 / patch / 内置组件
- [docs/roadmap.md](docs/roadmap.md) — 框架能力路线图与第一版限制
- [docs/build.md](docs/build.md) — 构建链、TypeScript 配置、playground

## 状态

第一版类组件与装饰器已落地；HMR / SSR / 静态分析 / 版本发布策略仍在后续范围。
