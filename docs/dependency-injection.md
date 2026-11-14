# 组件内数据层与依赖注入

> 状态：第一版已实现（`@Model` / `@UseModel` / `@Scope` / `@Named` / `ComponentScope`），代码与文档均已落地。
> 使用教程见 [model.md](./model.md)；本文记录设计、实现与限制。

## 1. 决策

| # | 决策 |
|---|---|
| 1 | `@UseModel` 第一版使用**显式 token**：`@UseModel(CounterData)` |
| 2 | 默认 scope = **component**（每个组件实例一份） |
| 3 | 数据类**复用组件生命周期装饰器**：`@Setup` / `@BeforeMount` / `@Mounted` / `@BeforeUpdate` / `@Updated` / `@BeforeUnmount` / `@Unmounted` / `@Activated` / `@Deactivated`，不新增 `@Init/@Dispose` |
| 4 | 支持 `@Scope('component' \| 'inherited' \| 'app')` 与 `@Named` / `@UseModel(Token, { name })` |
| 5 | Model `@Setup` 支持 `pre/after`（相对 owner 组件 `@Setup`）：默认 `pre`；`@Setup('after')` 可显式推迟 |
| 6 | Model `@Prop` 是组件同名 `@Prop` 的**只读投影**（组件必须声明）；Model 支持 `@Provide`（跨组件共享）与 async `@Setup` |

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
| `@Model` + `@UseModel` | ✅ 类表达“是什么”，字段表达“用它”；默认 component scope，可显式 inherited/app |

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
| `@Scope('component'\|'inherited'\|'app')` | 实例边界：组件私有 / 祖先共享 / App 单例 |
| `@Named('x')` | 同一 scope / token 的多实例 qualifier；字段级 `@UseModel(Token, { name })` 可覆盖 |
| `@Prop` | 只读投影 owner 组件的同名 `@Prop`（组件必须声明）；父更新自动反映，写入报错，Model 不需要时可以不写 |
| `@Provide` | Model setup 后把字段值 provide 给后代；写入 owner 注入表，快照语义（同组件 `@Provide`） |

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

```ts
@Scope('component' | 'inherited' | 'app')
```

| Scope | 实例 | owner / 生命周期 |
|---|---|---|
| `component`（默认） | 每个组件实例一份 | 当前组件 |
| `inherited` | 最近祖先已有 → 复用；没有 → 当前组件创建 | 创建它的祖先组件；消费者不重复 setup/hooks |
| `app` | 每个 AppContext 一份 | App；`@Setup` 首次解析，`@Mounted` 在 app mount，`@Unmounted` 在 app unmount |

缓存 key 为 `(appId, scope, token, name)`；`@Named` / `@UseModel(Token, { name })` 区分同 token 多实例。

- `component`：推荐默认；
- `inherited`：父页面/布局向子树共享同一 Model；
- `app`：全局配置 / 登录态 / app 级 service；注意 SSR 每请求独立、不要放模块级全局；
- 同一 scope 内按 token + name 缓存 → 单实例；
- 循环依赖检测后直接报错；
- 组件卸载时 component scope 销毁；inherited 由创建者销毁；app scope 由 app.unmount 销毁。

### 4.3 生命周期归属

- **谁创建，谁执行生命周期**：
  - component：当前组件；
  - inherited：创建实例的祖先；子组件只持有引用，不重跑 `@Setup`，不重复注册 hooks；
  - app：AppContext；component 的挂载/卸载不触发 app Model 钩子。
- `@Watch` / `@Computed` 绑定创建者的 EffectScope；inherited 消费者不复制。
- inherited Model 的 `@Prop` / `@Inject` 也属于创建者上下文，不是消费者上下文。
- app scope 只支持 `@Setup` / `@Mounted` / `@BeforeUnmount` / `@Unmounted`；`@Prop` / `@Provide` / 组件级 update/activate hooks 暂不支持。

## 5. 生命周期：复用组件语义

数据类不引入新的生命周期概念；装饰器与组件完全相同，执行时机跟随 owner 组件。

### 5.1 初始化顺序

```text
owner component 实例化 + initProps
→ ComponentScope 创建
→ 组件安装 @Prop/@Ref/@Reactive/@Computed/@Inject
→ 解析 @UseModel（构造 Model；@Prop 投影 owner 的 @Prop）
→ Model pre @Setup（依赖顺序；默认）
→ 组件 @Setup（sync 或 async）
→ Model after @Setup（仅显式 @Setup('after')）
→ 各 Model 的 @Provide/@Watch 安装（在各自 setup 后）
→ 组件 @Provide/@Watch
→ render
```

- **组件 `@Setup` 是基准点**：`pre` 在它之前，`after` 在它之后；
- Model 默认 `pre`；`@Setup('after')` 用于需要等组件 setup 派生状态的场景；
- `@Prop` 不再影响 setup 阶段：组件 props 在 Model 构造前已经就绪，Model 直接读取投影；
- 数据类之间按依赖深度排序；同一 scope 内共享实例；
- 数据类 `@Setup` 只执行一次；
- `pre` Model 不能依赖 `after` Model（阶段冲突会直接报错）。

> 例：组件 `@Prop initCount = 1`；Model `@Prop initCount!: number`；
> Model 的 `@Setup` 直接读 `this.initCount`，不需要组件手动赋值。
> 如果 Model 需要等组件的 `@Setup` 执行完，可写 `@Setup('after')`。

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

- Model `@Setup` 可返回 Promise；`pre` 阶段会等所有 pre Model resolve 后再执行组件 `@Setup`；
- `after` 阶段在组件 `@Setup`（含 async）resolve 后执行；
- 期间组件先渲染 `null` 占位；完成后切回真实 render；错误交给 owner 的错误处理；
- 多个 async Model 按依赖顺序串行等待；同步 Model 与异步 Model 可以混用。

## 6. 运行时接线

在 `mountClassComponent` 中插入 `ComponentScope`：

```text
new Ctor(props)
→ installClassPublicInstance
→ createComponentScope(instance)
→ 组件 installDeclaredFields（@Prop accessor 就位）
→ installUseModels(scope, component)
  → resolve：构造 Model；安装 @Prop 投影 / @Ref/@Reactive/@Computed/@Inject
→ 生命周期注册
→ scope.runPhase('pre')   // Model pre @Setup + Provide/Watch
→ 组件 @Setup             // 可 async
→ scope.runPhase('after') // 仅 @Setup('after') + Provide/Watch
→ 组件 @Provide/@Watch
→ render
```

关键点：

- Model 字段安装复用 `installReactiveApi`，但 owner 是组件实例（ref、watch、inject 都绑在 owner 上）；
- Model `@Prop` 是 owner 组件同名 `@Prop` 的只读 accessor；组件必须声明，父更新自动反映；
- Model `@Provide` 在 Model setup 完成后写入 owner 注入表，后代可 `@Inject`；
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

## 8. 默认 scope

- 默认 `component`：两个 `<Counter />` 各自拥有独立状态；
- `inherited` 用于父页面/布局向子树共享；
- `app` 用于真正的应用级 service；
- 全局可变状态要注意 KeepAlive、列表项、SSR 并发；app scope 是“每个 App 一份”，不是模块级全局。

## 9. 实现结果

新增/修改：

| 文件 | 内容 |
|---|---|
| `core/src/decorator/model.ts` | `@Model`、`@UseModel`、`@Scope`、`@Named` |
| `core/src/decorator/meta.ts` | `models` / scope / qualifier 元数据与合并规则 |
| `core/src/types/component.ts` | `ModelConstructor` / `isModel` / marker |
| `core/src/runtime/componentScope.ts` | component / inherited / app scope、qualifier、pre/after setup、异步 setup、Provide/Watch、生命周期归属 |
| `core/src/runtime/mountComponent.ts` | 组件挂载时创建 scope、pre setup → 组件 setup → after setup → render |
| `core/src/runtime/instance.ts` | `modelScope?` |
| `core/src/runtime/app.ts` | app scope 生命周期 hooks |
| `core/src/index.ts` / `actview` | 导出 `Model` / `UseModel` / `Scope` / `Named` / 类型 |

验收测试：

- `packages/core/__tests__/model.spec.tsx`（13 项）：基础 Model / async setup / @Prop / @Provide / 生命周期 / 循环依赖；
- `packages/core/__tests__/model-scope.spec.tsx`（4 项）：inherited 共享且生命周期归创建者、Named 多实例、app scope 单例 + app 生命周期、app scope `@Inject`。

全仓：`pnpm test` **437 passed / 4 skipped**；`pnpm typecheck` / `pnpm build` / `pnpm build:packages` 全绿。

### 当前限制

- `@Model` 构造函数必须无参（token 直接 `new`）；
- `@Prop` 必须由 owner 组件声明；Model 上的 `@Prop` 只是只读投影；
- `@Prop` / 组件 prop 均只读，写入会报错；
- `pre` Model 不能依赖 `after` Model（阶段冲突直接报错）；
- inherited Model 的 `@Prop` / `@Inject` / 生命周期属于创建者，不是消费者；
- app scope 暂不支持 `@Prop` / `@Provide` / async `@Setup`；组件级 update/activate hooks 不适用于 app scope；
- 循环依赖直接报错，不做代理；
- Model 不参与 DevTools 数据图展示。

## 10. 暂不做 / 后续

- 裸 `@UseModel` 类型推断（需要可选编译插件）；
- Model 构造参数注入；
- app scope 的 @Prop/@Provide/async setup；
- 循环依赖代理；
- Model 的 DevTools 可视化；
- HMR / SSR 的 scope 生命周期。
