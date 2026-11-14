# @actview/router

ActView 路由（v1）：`RouterView` / `RouterLink`、nested routes、params、query/hash、guards、lazy loader、三种 history。

## 安装 / 使用

```tsx
import { createApp } from 'actview'
import {
  RouterLink,
  RouterView,
  createRouter,
  createWebHistory,
} from '@actview/router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/user/:id', component: User, props: true },
  ],
})

createApp(App).use(router).mount('#app')
```

App：

```tsx
@Component({ name: 'App' })
class App extends ActViewComponent {
  render() {
    return (
      <div>
        <RouterLink to="/user/1">user</RouterLink>
        <RouterView />
      </div>
    )
  }
}
```

组件内拿 router：

```tsx
import { routerKey, type Router } from '@actview/router'

@Component
class Probe extends ActViewComponent {
  @Inject(routerKey)
  router!: Router

  render() {
    return <span>{this.router.currentRoute.path}</span>
  }
}
```

## History

- `createWebHistory(base?)`
- `createWebHashHistory()`
- `createMemoryHistory(initial?)`（测试 / SSR / 非浏览器）

## 路由记录

```ts
{
  path: '/user/:id',
  name: 'user',
  component: User,
  props: true, // params → props
  meta: { auth: true },
  beforeEnter: (to) => ...,
  loader: async (to) => {
    await fetchUser(to.params.id)
  },
  children: [...],
}
```

`loader` 在 guard 之后、切换 `currentRoute` 之前执行；`push/replace` 会等待 Promise。SSR 可以先 `await router.push(url)` 完成数据预取，再 `renderToString()`。

- `component` 可以是 `@Component` 类，也可以是 `() => Promise<{ default: ... }>`（自动走 `lazy`）；
- `redirect` 支持字符串 / 命名路由对象；
- 嵌套路由在父组件 render 中放一个 `<RouterView />`。

## 导航

```ts
await router.push('/user/1')
await router.replace('/login')

const resolved = router.resolve({
  name: 'user',
  params: { id: 1 },
  query: { tab: 'profile' },
  hash: 'info',
})

const stop = router.beforeEach((to, from) => {
  if (to.meta.auth) return '/login'
})
router.afterEach((to, from) => {})
```

## RouterLink

```tsx
<RouterLink
  to="/user/1"
  replace
  activeClass="active"
  exactActiveClass="exact-active"
>
  User
</RouterLink>
```

- 支持 `to` 字符串 / 命名路由对象；
- 支持 `replace`、`activeClass`、`exactActiveClass`、`target`；
- 自动防左键 / 修饰键 / 外部 target。

## v1 限制

- 无 `<router-view>` 的字符串全局组件注册，需直接 import；
- 无 scrollBehavior 的 savedPosition / 滚动恢复（基础 top 行为需显式配置）；
- 无 route meta 类型增强 / 命名视图；
- 无组件内 `onBeforeRouteLeave` 等 in-component guards；
- 无命名视图 / scrollPosition / 流式 SSR；
- 无 route transition 自动包裹。
