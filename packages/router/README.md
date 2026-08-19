# @actview/router

**ActView 的路由 —— 仿 Vue Router 最小版**：路由切换 = 组件切换，无守卫 / 懒加载等能力。

## 核心功能

- **路由表**：`createRouter({ history, routes })` 基于路径匹配路由记录
- **两种历史模式**：`createWebHistory`（浏览器 History API）、`createMemoryHistory`（内存模式，测试/SSR 用）
- **路由组件**：`RouterView`（路由出口）、`RouterLink`（导航链接）
- **当前路由**：`currentRouter` 全局单例，支持 `router.push` / `router.replace` 等导航

## 安装

```bash
pnpm add @actview/router
```

## 快速开始

```tsx
import { createRouter, createWebHistory, RouterView, RouterLink } from '@actview/router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
  ],
})

export function App() {
  return (
    <div>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <RouterView />
    </div>
  )
}
```

## API

| 导出 | 说明 |
|---|---|
| `createRouter(options)` | 创建路由实例（`RouterOptions`：`history` + `routes`） |
| `currentRouter` | 当前路由单例 |
| `createWebHistory(base?)` | History API 历史（浏览器地址栏） |
| `createMemoryHistory(base?)` | 内存历史（不操作浏览器地址） |
| `RouterView` | 路由出口组件（渲染匹配到的组件） |
| `RouterLink` | 导航链接组件 |
| 类型：`Router` / `RouterOptions` / `RouteLocation` / `RouteLocationRaw` / `RouterHistory` / `RouteRecord` / `MatchedRoute` | 路由相关类型 |

## 依赖关系

- `@actview/core`（组件渲染 / defineComponent 运行时）
- `@actview/jsx`（JSX 类型与工厂）

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # 走根目录 vitest（test/router/router.test.tsx 路由用例 + test/smoke 路由版页面渲染与切换）
```

## License

MIT
