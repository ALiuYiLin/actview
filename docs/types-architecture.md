# ActView 类型与包分层（第一版类组件）

> 本文描述当前（第一版类组件重构后）的包职责、类型边界与验证方式。
> 设计背景见 [class-component-design.md](./class-component-design.md)；渲染器见 [renderer-design.md](./renderer-design.md)；编译链见 [compiler-layers.md](./compiler-layers.md)。

## 1. 包职责

| 包 | 职责 | 入口 | 关键 API |
|---|---|---|---|
| `@actview/runtime-core` | 平台无关的公开类型 + 最小元素工厂 | `.` / `./internal` | `Element` / `ElementType` / `ClassComponent` / `BuiltinComponent` / `ComponentProps` / `Fragment` / `createElement` / `isClassComponent` / `isComponent` |
| `@actview/jsx` | JSX 作者层：全局 `JSX` 命名空间、DOM/SVG 属性类型、automatic runtime | `.` / `./jsx-runtime` / `./jsx-dev-runtime` | `jsx` / `jsxs` / `jsxDEV` / `Fragment`；再导出 runtime-core 公开类型 |
| `@actview/core` | DOM 运行时公开层：类组件运行时 + 装饰器 + 渲染器 | `.` | `createApp` / `ActViewComponent` / `@Component` / `@Prop` / `@Ref` / 生命周期装饰器 / `Suspense` / `KeepAlive` / `Teleport` / `Transition` / `nextTick` |
| `@actview/reactivity` | 响应式系统（ref / reactive / computed / effect / watch） | `.` | 供装饰器与渲染器内部使用；**不再是组件作者直接使用的 API** |
| `@actview/shared` | 内部工具 | — | 不对外 |
| `@actview/compiler` | 历史 L1 wrap 已删除；保留包与 Babel 依赖（装饰器降级 / 后续分析占位） | `.` | 当前无运行时 API |
| `actview` | 聚合空壳 | — | 暂未纳入（后续聚合入口） |

依赖方向：

```
reactivity → shared
runtime-core（无依赖）
jsx → runtime-core
core → runtime-core, reactivity
```

## 2. 第一版组件模型（类组件）

```tsx
@Component({ name: 'Counter' })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop initial = 1
  @Ref count = 0

  @Setup setup() { this.count = this.initial }
  @Mounted mounted() {}

  render() {
    return <button onClick={() => this.count++}>{this.count}</button>
  }
}
```

- 组件 = **带 `__actview_class_component` 标记的 class 构造器**（由 `@Component` 强制写入）；
- `render()` 必须实现；JSX `<Counter initial={1} />` 走类组件标签检查；
- `@Prop` 字段映射 `instance.props`（initializer 为缺省值）；
- `@Ref` 字段：装饰器只记录元数据，渲染器在 `new Ctor()` 后安装每实例 accessor（`this.count` 类型为 `number`，内部是 `ref`）；
- 生命周期：`@Setup` / `@BeforeMount` / `@Mounted` / `@BeforeUpdate` / `@Updated` / `@BeforeUnmount` / `@Unmounted` / `@Activated` / `@Deactivated`；
- 第一版数据装饰器只支持 `@Prop` / `@Ref`；`@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` 后续版本再加。

`ComponentProps<typeof Counter>` 优先从 `ActViewComponent<P>` 的 `$props` 声明推导，因此没有显式 constructor 也能得到精确 props。

## 3. 公开 vs 内部类型

- 公开：`Element`（4 个稳定字段）、`ElementType`（string / symbol / ClassComponent / BuiltinComponent）、`ClassComponent`、`BuiltinComponent`、`ComponentProps`、`RenderFunction`；
- 内部（`@actview/runtime-core/internal`）：`VNode`、`ClassComponentCtor`、`ComponentInternalInstance`、`createVNode`、`isVNode`、`Fragment`；
- 渲染器实现类型（`ComponentInternalInstance` 完整字段、`ctx`、hooks）在 `@actview/core/src/instance.ts`，不进入公开入口。

## 4. 验证命令

```bash
pnpm typecheck       # 根 app + 全部包 src + type-tests（project references）
pnpm test            # reactivity + runtime-core + core
pnpm build           # tsc -b + vite build（类组件 + esbuild legacy decorators）
pnpm build:packages  # tsup 各包（含 d.ts）
```

当前基线：17 个测试文件通过 / 1 skipped，393 passed / 4 skipped（compiler wrap 测试随 L1 删除；core 60 条、runtime-core 3 条）。

## 5. 已知边界

- `@Component` 必须显式使用（不做“有 render 就算组件”的猜测）；
- 组件实例由渲染器创建；手动 `new Counter()` 不会安装 `@Ref`/`@Prop` accessor；
- 构造函数内部读到的是普通字段（accessor 尚未安装），初始化请放在 `@Setup`；
- legacy decorators（`experimentalDecorators`）；Stage-3 迁移（`accessor` 字段）后续处理；
- 方法作为事件处理器直接传递时需要保持 `this`（推荐箭头函数字段或 `@Bind`，后者后续提供）；
- `emitDecoratorMetadata` 在 esbuild 链路不会生成 `Reflect.metadata`，不要依赖 `design:type`。

## 6. 决策记录

1. **类型分层不泄漏 VNode**：公开 `Element` 只保留稳定字段；VNode / 实例内部字段只经 `./internal`。
2. **类组件是唯一组件形态**：删除 `defineComponent` / 函数组件 / `ComponentFunction` / `ComponentTag` 函数视图。
3. **`@Ref` 不用 Proxy**：装饰器记录元数据，渲染器构造后安装 accessor，避免 ES2022 class field 遮蔽与 `#private` 问题。
4. **compiler L1 wrap 删除，Babel 保留**：JSX 降级仍由宿主 automatic runtime（`jsxImportSource=@actview/jsx`）完成；compiler 包暂为占位，后续用于装饰器/静态分析。
