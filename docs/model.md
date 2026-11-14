# @Model 使用指南

> `@Model` 是 ActView 的组件内数据层：把状态、派生值、监听、生命周期和业务行为从组件类中拆出来。
>
> 设计细节 / 实现约束见 [dependency-injection.md](./dependency-injection.md)。

## 1. 最小示例

```tsx
import {
  ActViewComponent,
  Component,
  Computed,
  Model,
  Ref,
  Setup,
  UseModel,
} from 'actview'

@Model
class CounterData {
  @Ref
  count = 0

  @Computed
  get double(): number {
    return this.count * 2
  }

  increment(): void {
    this.count++
  }
}

@Component({ name: 'Counter' })
class Counter extends ActViewComponent {
  @UseModel(CounterData)
  data!: CounterData

  @Setup
  setup(): void {
    this.data.count = 1
  }

  render() {
    return (
      <button onClick={() => this.data.increment()}>
        {this.data.count} / {this.data.double}
      </button>
    )
  }
}
```

要点：

- `@Model` 类**不是组件**，不实现 `render()`；
- `@UseModel(CounterData)` 是显式 token，不能写裸 `@UseModel data`；
- 每个组件实例默认拥有自己的 `CounterData`；
- 组件 render 读取 `this.data.count` 时正常依赖收集；
- Model 方法修改状态会触发 owner 组件重新 render。

## 2. Model 支持什么

| 能力 | 用法 |
|---|---|
| 响应式原始值 | `@Ref` |
| 响应式对象 / 数组 | `@Reactive` |
| 派生值 | `@Computed get xxx()` |
| 监听 | `@Watch('field') method()` |
| 生命周期 | `@Setup` / `@Mounted` / `@Unmounted` 等 |
| 依赖其他 Model | `@UseModel(OtherModel)` |
| 组件 Prop 投影 | `@Prop` |
| 注入祖先 / App 值 | `@Inject` |
| 向子树提供 | `@Provide` |
| 作用域 | `@Scope('component' \| 'inherited' \| 'app')` |
| 多实例 qualifier | `@Named('x')` / `@UseModel(Token, { name: 'x' })` |

## 3. 组件如何注入 Model

```tsx
@Component
class Page extends ActViewComponent {
  @UseModel(PageData)
  page!: PageData
}
```

- 字段名随意；
- token 必须是 `@Model` 类；
- Model 在组件 `@Setup` 前安装；
- 同一组件实例内，同一 `(token, name)` 只创建一次。

### 多依赖

```tsx
@Model
class UserData {
  @Ref name = 'Ada'
}

@Model
class OrderData {
  @UseModel(UserData)
  user!: UserData

  @Ref orders: string[] = []
}

@Component
class Page extends ActViewComponent {
  @UseModel(OrderData)
  orders!: OrderData

  @UseModel(UserData)
  user!: UserData
}
```

在同一个组件 scope 内，`Page.user` 与 `OrderData.user` 是**同一个实例**。

## 4. 生命周期

Model 复用组件生命周期装饰器：

```tsx
@Model
class PageData {
  @Ref loading = false

  @Setup
  setup(): void {}

  @Mounted
  mounted(): void {}

  @BeforeUnmount
  beforeUnmount(): void {}

  @Unmounted
  unmounted(): void {}
}
```

默认顺序：

```text
Model @Setup
→ 组件 @Setup
→ Model @Mounted
→ 组件 @Mounted
...
→ 组件 @Unmounted
→ Model @Unmounted
```

`@Setup` 默认在组件 `@Setup` **之前**；如果确实需要等组件 setup 完成：

```tsx
@Model
class PageData {
  @Setup('after')
  setup(): void {}
}
```

组件 `@Setup` 是基准点，组件自身不能写 `@Setup('pre' | 'after')`。

## 5. `@Prop`：使用组件 Prop

Prop 的唯一来源是**组件**；Model 只做只读投影。

```tsx
@Component
class Page extends ActViewComponent {
  @Prop
  pageId = ''

  @UseModel(PageData)
  data!: PageData
}

@Model
class PageData {
  @Prop
  pageId!: string

  @Ref
  loadedId = ''

  @Setup
  setup(): void {
    this.loadedId = this.pageId
  }
}
```

规则：

- 组件必须声明同名 `@Prop`；
- Model `@Prop` 是只读投影，组件 prop 更新会反映到 Model；
- Model 不需要时可以完全不写；
- Model 写了但组件没声明 → mount 报错；
- 组件 `@Prop` 和 Model `@Prop` 均不允许写入。

## 6. Scope：实例共享边界

### component（默认）

每个组件实例一份：

```tsx
@Model
class EditorData {
  @Ref text = ''
}

@Component
class Page extends ActViewComponent {
  @UseModel(EditorData)
  data!: EditorData
}
```

两个 `<Page />` 数据互不影响。

### inherited：父子共享

```tsx
@Model
@Scope('inherited')
class PageData {
  @Ref keyword = ''
}

@Component
class Page extends ActViewComponent {
  @UseModel(PageData)
  page!: PageData
  render() { return <Child /> }
}

@Component
class Child extends ActViewComponent {
  @UseModel(PageData)
  page!: PageData // 与 Page 同一个实例
}
```

- 最近祖先已有 → 复用；
- 没有 → 当前组件创建；
- **生命周期只归创建者**：消费者不重跑 `@Setup`，不重复注册 `@Mounted/@Unmounted`；
- inherited Model 的 `@Prop` / `@Inject` 也属于创建者上下文；
- 子组件卸载不会触发 Model `@Unmounted`，创建者卸载才会。

### app：App 级实例

```tsx
@Model
@Scope('app')
class SessionData {
  @Ref token = 'guest'
}
```

- 每个 `createApp()` 一份；
- 所有组件共享；
- `@Setup` 首次解析时执行；
- `@Mounted` 跟 App mount；
- `@BeforeUnmount` / `@Unmounted` 跟 App unmount。

app scope 当前限制：

- 不支持 `@Prop`；
- 不支持 `@Provide`；
- 不支持 async `@Setup`；
- 只支持 `@Setup` / `@Mounted` / `@BeforeUnmount` / `@Unmounted`。

## 7. `@Named`：同一类的多个实例

```tsx
@Model
@Named('primary')
class EditorData {
  @Ref text = ''
}

@Component
class Editor extends ActViewComponent {
  @UseModel(EditorData)
  primary!: EditorData

  @UseModel(EditorData, { name: 'secondary' })
  secondary!: EditorData
}
```

- 类级 `@Named('primary')` 是默认 qualifier；
- 字段级 `@UseModel(Token, { name })` 可覆盖；
- `primary` 与 `secondary` 是两个独立实例；
- 同一 `(token, name)` 在同一个 scope 内仍然单实例。

## 8. `@Provide` / `@Inject`

Model 可以向 owner 的子树 provide：

```tsx
@Model
class ThemeData {
  @Provide()
  theme = 'dark'
}

@Component
class ThemeProvider extends ActViewComponent {
  @UseModel(ThemeData)
  data!: ThemeData
  render() { return <Child /> }
}

@Component
class Child extends ActViewComponent {
  @Inject('theme')
  theme!: string
  render() { return <span>{this.theme}</span> }
}
```

- Model `@Provide` 写入 owner 组件的注入表；
- 只对 owner 的后代可见；
- 是快照语义；需要响应式时 provide 对象 / `@Reactive` 值；
- inherited Model 的 `@Provide` 属于创建者。

Model 也可以读取祖先 / App 注入：

```tsx
@Model
class PageData {
  @Inject('theme')
  theme!: string
}
```

## 9. async `@Setup`

component / inherited Model 支持 async：

```tsx
@Model
class PageData {
  @Ref ready = false

  @Setup
  async setup(): Promise<void> {
    await load()
    this.ready = true
  }
}
```

- pre 阶段会等待所有 async pre Model；
- 之后才执行组件 `@Setup`；
- 首帧渲染 null，完成后切真实内容；
- app scope 暂不支持 async `@Setup`。

## 10. 完整分层示例

```tsx
@Model
class UserData {
  @Ref name = 'Ada'
}

@Model
class OrderData {
  @UseModel(UserData)
  user!: UserData

  @Ref orders: string[] = []

  @Computed
  get count(): number {
    return this.orders.length
  }
}

@Component
class Page extends ActViewComponent {
  @Prop
  userId = ''

  @UseModel(OrderData)
  orderData!: OrderData

  @UseModel(UserData)
  userData!: UserData

  render() {
    return (
      <section>
        <p>{this.userData.name}</p>
        <p>{this.orderData.count}</p>
      </section>
    )
  }
}
```

组件负责 props、组合和 render；Model 负责状态、派生值和业务行为。

## 11. 规则与常见问题

1. **必须显式 token**
   - `@UseModel(CounterData)`；
   - 裸 `@UseModel counterData` 需要类型元数据，当前 esbuild 链路不支持。

2. **Model 构造函数必须无参**
   - 当前实例化方式是 `new Token()`；
   - 依赖用 `@UseModel` / `@Inject` 注入；
   - props 用 `@Prop` 投影。

3. **Model 不是组件**
   - 不要实现 `render()`；
   - 不要把它当 JSX 标签使用。

4. **Prop 只读**
   - 组件和 Model 都不能写 prop；
   - 需要派生值用 `@Computed`，需要本地状态用 `@Ref`。

5. **生命周期归创建者**
   - inherited 消费者不重复 setup / mounted / unmounted；
   - 不要手动调用 Model 的生命周期方法。

6. **app scope 不是模块级全局**
   - 每个 App 一份；
   - SSR 每请求应独立；
   - 不要把用户请求数据放到模块级变量。

7. **循环依赖直接报错**
   - 不做代理；
   - 设计 Model 依赖时保持单向。

8. **DevTools**
   - backend 可读取 Model 状态；
   - 依赖图 UI 尚未实现。

## 12. API 速查

```tsx
import {
  Model,
  UseModel,
  Scope,
  Named,
  Ref,
  Reactive,
  Computed,
  Watch,
  Prop,
  Provide,
  Inject,
  Setup,
  Mounted,
} from 'actview'
```

| API | 作用 |
|---|---|
| `@Model` | 标记可注入数据层类 |
| `@UseModel(Token, { name? })` | 注入 Model 单实例 |
| `@Scope('component' \| 'inherited' \| 'app')` | 实例生命周期边界 |
| `@Named('x')` | 同一 scope 内多实例 qualifier |
| `@Ref` / `@Reactive` | 状态 |
| `@Computed` / `@Watch` | 派生值 / 监听 |
| `@Prop` | 组件 prop 的只读投影 |
| `@Provide` / `@Inject` | 向子树提供 / 读取注入 |
| `@Setup` | 初始化（可 `pre` / `after`） |
| 生命周期装饰器 | 与组件同一套语义，归创建者 |

更多设计细节：[dependency-injection.md](./dependency-injection.md)、[decorators.md](./decorators.md)。
