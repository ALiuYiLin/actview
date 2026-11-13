# @actview/devtools

ActView DevTools **backend**（暂无面板 / 浏览器扩展）。

负责：

- 通过 `app.use(devtoolsPlugin)` 注册 core DevTools hook；
- 维护 app / component 树；
- 记录 mount / update / unmount / track / trigger / performance 事件；
- 提供 `getSnapshot()`、`subscribe()`、`getComponentState()`；
- 读取 props、类实例 state、computed、`@Model` 状态。

## 使用

```tsx
import { createApp } from 'actview'
import { devtoolsPlugin, getDevtoolsBackend } from '@actview/devtools'

const app = createApp(App)

if (import.meta.env.DEV) {
  app.use(devtoolsPlugin, { appName: 'My App' })
}

app.mount('#app')

// 后续浏览器扩展 / 内嵌面板使用：
const backend = getDevtoolsBackend()
const unsubscribe = backend.subscribe((snapshot) => {
  console.log(snapshot.apps, snapshot.components)
})

const state = backend.getComponentState(componentId)
```

## API

| API | 内容 |
|---|---|
| `devtoolsPlugin` | App 插件；安装 hook / 注册 app 清理 |
| `getDevtoolsBackend(options?)` | 获取全局 backend |
| `resetDevtoolsBackend()` | 清空 store 并解除 hook（测试 / HMR） |
| `backend.getSnapshot()` | app 树 / component 树 / 事件 / 性能记录 |
| `backend.subscribe(fn)` | 订阅快照，返回取消函数 |
| `backend.getComponentState(id)` | props / state / computed / Model 状态 |
| `backend.detachApp(appId)` | 移除某个 app 的采集数据 |

## 状态

- 已实现 backend；
- 暂无 UI、面板、浏览器扩展；
- `onTrack` / `onTrigger` 已接入 render effect 与 `@Computed`；
- 目前只采集数据，不提供状态编辑 / 时间旅行。
