# 组件内数据层与依赖注入（第一版已实现）

> 状态：第一版已实现（`@Model` / `@UseModel` / `ComponentScope`），代码与文档均已落地。
> 范围：**只做组件内数据层**（per-component scope）；不做 app 级单例 / qualifier。
> 相关文档：[decorators.md](./decorators.md) · [renderer.md](./renderer.md)

## 1. 决策

| # | 决策 |
|---|---|
| 1 | `@UseModel` 第一版使用**显式 token**：`@UseModel(CounterData)` |
| 2 | 数据类实例作用域 = **per-component-instance**（每个组件实例一份） |
| 3 | 数据类**复用组件生命周期装饰器**：`@Setup` / `@BeforeMount` / `@Mounted` / `@BeforeUpdate` / `@Updated` / `@BeforeUnmount` / `@Unmounted` / `@Activated` / `@Deactivated`，不新增 `@Init/@Dispose` |
| 4 | 第一版**不做** `@Scope('app')` / `@Scope('inherited')` / `@Named` |

### 1.1 命名：`@Model` + `@UseModel`

- **类装饰器 `@Model`**：标记“挂在组件实例上的 Model 类”（状态 + 行为 + 生命周期），不是全局单例，也不是 Lombok 式纯数据对象；
- **字段装饰器 `@UseModel(Token)`**：在组件 / Model 中声明“使用某个 Model 的单实例”，动作明确，不暗示 Spring 的全局单例注入；
- `@Component` 与 `@Model` 互斥：`@Component` 必须实现 `render()`，`@Model` 不允许声明 `render()`。

候选命名对比：

| 候选 | 问题 |
|---|---|
| `@Data` | 与 Lombok `@Data` 冲突；暗示纯数据，但 Model 还承载行为与生命周期 |
| `@Autowired` | Spring 语义 = 全局 bean 注入，容易误解为 app 单例 |
| `@Inject` | 已被现有 provide/inject 占用，且那是祖先层级注入，不是组件内 Model |
| `@Service` / `@Store` | 容易联想到全局 service / 全局 store（Vuex/Pinia） |
| `@ViewModel` 作为字段 | ViewModel 是角色名，不是“注入某个 Model”的动作；且 Model 不一定是 view 专用 |
| `@Model` + `@UseModel` | ✅ 类表达“是什么”，字段表达“用它”；作用域由文档和运行时保证 per-component |

> 如果团队更偏好绝对明确，也可用 `@ComponentModel` + `@UseModel` 作为长命名备选；`@Model` 是更短的默认选择。

## 2. 目标

- 组件类负责渲染与少量协调逻辑；状态、行为、派生值、监听放入数据类：
  ```tsx
  @Model
  class CounterData {
    @Ref count = 0
    @Computed get double() { return this.count * 2 }
    @Watch('count') onCount(v: number) {}
    @Setup setup() {}
    increment() { this.count++ }
  }

  @Component({ name: 'Counter' })
  class Counter extends ActViewComponent<{ initial?: number }> {
    @UseModel(CounterData)
    counterData!: CounterData

    @Setup
    setup() { this.counterData.count = this.$props.initial ?? 0 }

    render() {
      return <button onClick={() => this.counterData.increment()}>
        {this.counterData.count} / {this.counterData.double}
      </button>
    }
  }
  ```
- 组件 render 读取 `counterData.count` 时正常依赖收集；数据类方法写状态只会触发 owner 组件重渲染。
- 同一组件实例内，同一 token 只实例化一次；多个数据类依赖同一个数据类时共享实例。

## 3. 数据类支持的能力

数据类不是 `@Component`，不实现 `render()`；使用同一套装饰器：

| 装饰器 | 数据类语义 |
|---|---|
| `@Ref` / `@Reactive` | 状态；accessor 安装到数据类实例，ref 的依赖由 owner 组件 render effect 收集 |
| `@Computed` / `@Watch` | 注册到 owner 组件的 `scope`；组件卸载自动停止 |
| `@Inject` | 读取祖先 `provide`（复用 owner 组件的注入表） |
| `@UseModel` | 注入其他数据类（递归解析，scope 内缓存） |
| `@Setup` 及生命周期装饰器 | 与组件生命周期同一时机（见 §5） |
| `@Prop` | 第一版不支持；props 由组件在 `@Setup` 中写入数据类 |
| `@Provide` | 第一版不支持（跨组件共享继续用组件上的 `@Provide`） |

## 4. Token 与 Scope

### 4.1 Token

```tsx
@UseModel(CounterData)
counterData!: CounterData
```

原因：TypeScript 类型在运行时被擦除；当前 esbuild 链路不会生成 `design:type` 元数据，裸
`@UseModel counterData` 无法知道实例化哪个类。后续如需要裸注解，可加可选 Vite/Babel AST 插件
把字段类型推断成显式 token；第一版不做。

### 4.2 Scope

- 每个 `mountClassComponent` 创建一个 `ComponentScope`：
  ```ts
  interface ComponentScope {
    owner: ComponentInternalInstance
    instances: Map<Function, object>
    resolving: Set<Function>
    resolve<T>(token: Function): T
  }
  ```
- 默认 per-component，不继承父 scope，不做全局单例；
- 同一 scope 内按 token 缓存 → 单实例；
- 循环依赖检测后**直接报错**（带依赖链路），不做 Spring 式代理；
- 组件卸载时 scope 销毁（computed/watch 由 owner scope 停止；数据类无需额外 dispose）。

## 5. 生命周期：复用组件语义

数据类不引入新的生命周期概念；装饰器与组件完全相同，执行时机跟随 owner 组件。

### 5.1 初始化顺序

```text
owner component 实例化
→ ComponentScope 创建
→ 解析 @UseModel（深度优先，依赖数据类先创建）
→ 数据类安装 @Ref/@Reactive/@Computed/@Watch/@Inject
→ 数据类 @Setup（按依赖顺序）
→ 组件安装自己的字段 / @Computed
→ 组件 @Setup
→ 数据类 @Provide/@Watch 安装（若未来支持）
→ 组件 @Mounted 等生命周期
```

- 数据类 `@Setup` 在 owner 组件 `@Setup` 之前，保证组件 setup 时数据类已初始化；
- 数据类之间按依赖深度排序；同一 scope 内共享实例；
- 数据类 `@Setup` 只执行一次。

### 5.2 生命周期 hook 顺序

数据类 hooks 注册进 owner 组件的同一组 hooks 数组，不新增 API：

| 阶段 | 顺序 |
|---|---|
| `beforeMount` / `mounted` | 依赖数据类（依赖顺序）→ owner 组件 |
| `beforeUpdate` / `updated` | 依赖数据类 → owner 组件（与组件 hook 同轮） |
| `activated` | 依赖数据类 → owner 组件（KeepAlive 激活） |
| `deactivated` / `beforeUnmount` / `unmounted` | owner 组件 → 依赖数据类（逆序） |

说明：数据类作为 owner 的内部依赖，初始化/挂载先于 owner；卸载时 owner 先收尾、依赖后收尾，
与组件树“父卸载先于子清理”的直觉一致。

### 5.3 async `@Setup`

第一版与组件一致：允许返回 Promise；resolve 后再完成数据类/组件的后续生命周期与 render。
（async 数据类初始化的错误交给 owner 的错误处理。）

## 6. 运行时接线

建议在现有 `mountClassComponent` 中插入 `ComponentScope`：

```text
new Ctor(props)
→ installClassPublicInstance
→ createComponentScope(instance)
→ resolveAutowiredFields(scope, component)
→ installReactiveApiForData（复用 installReactiveApi，owner = 组件实例）
→ data @Setup
→ installReactiveApi（组件字段）
→ installLifecycle
→ component @Setup
→ @Provide/@Watch
→ render
```

关键点：

- 数据类字段安装复用 `installReactiveApi`，但 owner 是组件实例（ref、watch、inject 都绑在 owner 上）；
- `@UseModel` 字段安装为实例 accessor 或直接赋值；scope 缓存保证单实例；
- 数据类 `@Watch` 的 handler 以数据类实例为 `this`，watch 随 owner scope 停止；
- 数据类不参与 patch / DOM / DevTools 组件列表。

## 7. 多层数据示例

```tsx
@Model class UserData {
  @Ref name = 'Ada'
}

@Model class OrderData {
  @UseModel(UserData) user!: UserData
  @Ref orders: string[] = []
}

@Component
class Page extends ActViewComponent {
  @UseModel(OrderData) orderData!: OrderData
  @UseModel(UserData) userData!: UserData // 与 OrderData 内同一实例
}
```

- 数据层之间依赖少时，可以按职责分 UserData / OrderData；
- 公共部分留在组件类（协调数据层、处理 props、组织 render），或单独抽公共 `@Model` 类。

## 8. 为什么默认 per-component

- 两个 `<Counter />` 应各自拥有独立状态；
- 全局单例会污染 KeepAlive、列表项、SSR 并发；
- 跨组件共享继续用 `@Provide/@Inject`（显式、层级清晰）；
- app 级单例如未来需要，再单独设计 `@Scope('app')`，不混入第一版。

## 9. 实现结果

新增/修改：

| 文件 | 内容 |
|---|---|
| `core/src/decorator/model.ts` | `@Model` 类装饰器、`@UseModel(Token)` 属性装饰器 |
| `core/src/decorator/meta.ts` | `models` 元数据、合并规则 |
| `core/src/types/component.ts` | `ModelConstructor` / `isModel` / marker |
| `core/src/runtime/componentScope.ts` | `ComponentScope`：解析、缓存、循环检测、生命周期排序 |
| `core/src/runtime/mountComponent.ts` | 组件挂载时创建 scope、解析 `@UseModel`、注入生命周期顺序 |
| `core/src/runtime/instance.ts` | `modelScope?` |
| `core/src/index.ts` / `actview` | 导出 `Model` / `UseModel` / `ModelToken` |

验收测试 `packages/core/__tests__/model.spec.tsx`（8 项）：

- `@Ref/@Computed` 驱动 render，方法修改状态触发更新；
- 两个组件实例的数据隔离；
- 多数据层共享同一 `UserData` 实例；
- `@Setup/@Mounted` 先于 owner，`@Unmounted` 后于 owner；
- `@Watch` 数据字段监听；
- `@Inject` 从祖先 provide 取值；
- `@Model` 不允许实现 `render()`；
- 循环依赖报错并给出链路。

全仓：`pnpm test` 405 passed / 4 skipped；`pnpm typecheck` / `pnpm build` 全绿。

### 第一版限制

- `@Model` 构造函数必须无参（token 直接 `new`）；
- Model `@Setup` 必须同步；async Model 初始化后续再支持；
- 不支持 `@Prop` / `@Provide`（组件负责 props 与跨组件共享）；
- 无 app scope / inherited scope / qualifier；
- 循环依赖直接报错，不做代理。

## 10. 暂不做 / 后续

- 裸 `@UseModel` 类型推断（需要可选编译插件）；
- `@Scope('app')` / `@Scope('inherited')` / `@Named`；
- 数据类 `@Prop` / 构造 props；
- 数据类 `@Provide`；
- 循环依赖代理；
- HMR / SSR 的 scope 生命周期。
