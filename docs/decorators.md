# 类组件与装饰器

> 当前组件模型：唯一形态是 `@Component` 类。`defineComponent` / 函数组件已删除。
> 架构与包结构见 [architecture.md](./architecture.md)。

## 1. 基础

```tsx
import {
  ActViewComponent,
  Component,
  Prop,
  Ref,
  Reactive,
  Computed,
  Watch,
  Provide,
  Inject,
  Setup,
  BeforeMount,
  Mounted,
  BeforeUpdate,
  Updated,
  BeforeUnmount,
  Unmounted,
  Activated,
  Deactivated,
} from 'actview'

@Component({ name: 'Counter' })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop initial = 1
  @Ref count = 0
  @Reactive user = { name: 'Ada' }
  @Computed get double() { return this.count * 2 }
  @Watch('count') onCount(value: number, oldValue: number) {}

  @Setup setup() { this.count = this.initial }
  @Mounted mounted() {}
  @Unmounted unmounted() {}

  render() {
    return <button onClick={() => this.count++}>{this.count}/{this.double}</button>
  }
}
```

- `@Component` 必须显式使用；缺失时不会被识别为组件；
- 类必须实现 `render()`；
- 需要 props 时继承 `ActViewComponent<Props>`（或声明 constructor(props)）。

## 2. 数据装饰器

| 装饰器 | 语义 | 说明 |
|---|---|---|
| `@Prop` | 字段映射 `instance.props[key]` | initializer 作为缺省值；父更新 props 触发 render |
| `@Ref` | 字段等价于 `ref` 的 `.value` | `this.count: number`；`this.count++` 触发所属组件 re-render |
| `@Reactive` | 对象 / 数组字段变成 `reactive`（或 `shallowReactive`） | 原始值字段请用 `@Ref` |
| `@Computed` | getter → 按实例 `computed` | 惰性求值 + 缓存；必须用于 getter |
| `@Watch(source, options?)` | 方法监听 | source：字段名 / 字段名数组 / getter；支持 `immediate` / `deep` |
| `@Provide` | 把字段值 provide 给后代 | 字段级；key 默认为字段名，可 `@Provide('alias')` |
| `@Inject(key?, default?)` | setup 期解析注入值 | 快照语义；`@Inject('theme')` / `@Inject('missing', 'fallback')` |

`@Ref` 的实现：装饰器只记录元数据；`mountClassComponent` 在 `new Ctor()` 后摘掉 class field 产生的 own data property，再安装每实例 accessor（闭包持有 `ref`）。因此不依赖 `useDefineForClassFields` 全局配置，也不使用 Proxy。

## 3. 生命周期装饰器

`@Setup`、`@BeforeMount`、`@Mounted`、`@BeforeUpdate`、`@Updated`、`@BeforeUnmount`、`@Unmounted`、`@Activated`、`@Deactivated`。

`@Setup` 在实例创建后、首帧前执行一次；可返回 Promise（async setup，首帧渲染 null，resolve 后渲染）。

## 4. 安装顺序

```text
new Ctor(props)
→ 公开实例（$ / $props / $el / ...）
→ @Prop / @Ref / @Reactive / @Inject
→ @Computed
→ 生命周期注册
→ @Setup
→ @Provide / @Watch
→ render
```

async `@Setup` 时，`@Provide` / `@Watch` 在 Promise resolve 后安装。

## 5. 注入示例

```tsx
@Component({ name: 'ThemeProvider' })
class ThemeProvider extends ActViewComponent {
  @Provide() theme = 'dark'
  render() { return <Child /> }
}

@Component({ name: 'Child' })
class Child extends ActViewComponent {
  @Inject('theme') theme!: string
  @Inject('missing', 'fallback') fallback!: string
  render() { return <span>{this.theme}:{this.fallback}</span> }
}
```

## 6. 注意事项

- 组件必须由渲染器实例化；手动 `new Counter()` 不会安装 `@Ref` / `@Prop` accessor；
- 构造函数内部读到的是普通字段（accessor 尚未安装），初始化请放在 `@Setup`；
- `@Inject` 是 setup 期快照；需要响应式注入时 provide `@Reactive` 对象 / `ref`，并在 render 中读取；
- `@Provide` 当前只支持字段级；方法级提供、`@Bind` 后续再补；
- 装饰器使用 legacy 模式（`experimentalDecorators: true`）；`emitDecoratorMetadata` 在 esbuild 下不会生成 `Reflect.metadata`，不要依赖 `design:type`。
