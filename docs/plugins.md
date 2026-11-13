# App 插件系统

> 第一版核心契约已实现：`app.use` / `app.onUnmount` / `app.config`。
> 官方插件（router / devtools / logger 等）尚未实现；本文记录契约、安装规则与目标形态。

## 1. 插件契约

```ts
import type { App, AppPlugin, Plugin } from 'actview'

export interface AppPlugin<Options = unknown> {
  name?: string
  install(app: App, options?: Options): void
}

export type Plugin<Options = unknown> =
  | AppPlugin<Options>
  | ((app: App, options?: Options) => void)
```

- 对象插件：`{ name?, install(app, options) }`；
- 函数插件：`(app, options) => void`；
- `install` 必须是**同步**的；异步初始化由插件自己 provide Promise/Ref；
- 同一插件对象 / 函数只安装一次；
- 必须在 `mount()` 之前调用；mount 之后抛错；
- install 抛错时，该插件不会被标记为已安装，可以修复后重试。

```tsx
const app = createApp(App)

app
  .use(analyticsPlugin, { endpoint: '/api/analytics' })
  .provide(ConfigKey, config)
  .onUnmount(() => cleanup())

app.mount('#app')
```

## 2. App 配置

```ts
interface AppConfig {
  errorHandler?: (err, instance, info) => void
  warnHandler?: (msg, instance?, trace?) => void
  performance?: boolean
  devtools?: boolean
}
```

- `devtools` 默认 `__DEV__`；
- `performance` 默认 `false`，供 DevTools / 性能插件使用；
- `warnHandler` 开发期警告处理；
- 不建议 `globalProperties`：插件用 `app.provide` / `@Inject` / `@Model`。

## 3. 卸载清理

```ts
app.onUnmount(() => {
  // 插件自己的清理；app.unmount() 后执行一次
})
```

- 多个回调按注册顺序执行；
- 只执行一次（卸载后清空）；
- 单个回调抛错不会阻断其它回调。

## 4. 官方插件规划

### P0 `@actview/devtools`

功能：

- 根据 `app.config.devtools` / dev 环境注册 `setDevtoolsHook`；
- mount / update / unmount 采集；
- 组件树、props/state、事件、Model 依赖图；
- 接 `onTrack` / `onTrigger`（当前尚未接线）；
- `app.onUnmount` 解除 hook。

```tsx
if (import.meta.env.DEV) {
  app.use(devtoolsPlugin, { appName: 'My App' })
}
```

### P0 `@actview/router`

功能：

- `createRouter({ routes, history })`；
- `app.use(router)` 提供 router、注册路由组件；
- 嵌套路由、参数、守卫、懒加载、滚动恢复；
- 与 KeepAlive / Transition / Suspense 配合。

```tsx
const router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/user/:id', component: User },
  ],
})

createApp(App).use(router).mount('#app')
```

### P1 `@actview/logger`

- 安装 `config.errorHandler` / `warnHandler`；
- dev 错误 overlay、组件栈；
- 生产错误上报接口。

```tsx
app.use(loggerPlugin, {
  onError: (err, info) => report(err, info),
})
```

### P1 `@actview/i18n`

```tsx
app.use(i18nPlugin, { locale: 'zh', messages })

@Model
class PageModel {
  @Inject(I18nKey) i18n!: I18n
  @Computed get title() { return this.i18n.t('page.title') }
}
```

### P1 `@actview/query`

```tsx
app.use(queryClient)

@Model
class UserModel {
  @Inject(QueryClientKey) query!: QueryClient
}
```

### P2 UI 库插件

- 依赖 `app.component` + `Dynamic` 字符串解析；
- 或直接按 import 使用，不需要插件。

### 构建插件（不是 app.use）

- `@actview/plugin-vite`：HMR、错误 overlay、SSR 构建；
- 可选 `@actview/plugin-babel`：装饰器 / 静态分析。

## 5. 暂不实现

- `app.component` / `app.directive`：需要全局解析规则与 JSX 指令语法；
- `globalProperties`：破坏类组件封装；
- 插件依赖拓扑/异步安装：第一版按 `app.use` 顺序同步安装；
- 全局状态 store：优先使用 `@Model` + `@Provide/@Inject`。
