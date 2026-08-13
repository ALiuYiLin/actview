# @actview/devtools

ActView 运行时调试工具。收集组件树与响应式事件流，供调试面板 / 浏览器扩展接入。

## 安装

```bash
pnpm add @actview/devtools
```

## 使用

```tsx
import { initDevTools, mountPanel } from '@actview/devtools'

// 应用入口，开发环境启用
if (import.meta.env.DEV) {
  initDevTools()
  mountPanel() // 右下角浮层面板（可选）
}

createApp(App).mount('#app')
```

## 全局 Hook

`initDevTools()` 会暴露 `window.__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__`：

| 方法 | 说明 |
|---|---|
| `getComponentTree()` | 组件树节点数组（id/name/parentId/children） |
| `getEventLog()` | 事件流（mount/update/unmount/track/trigger） |
| `subscribe(cb)` | 订阅快照变化，返回取消函数 |
| `reset()` | 清空数据 |

浏览器扩展可通过该 hook 读取组件树与事件流，实现可视化面板。

## API

| 导出 | 说明 |
|---|---|
| `initDevTools()` | 启动埋点 + 暴露 window hook（幂等） |
| `mountPanel(container?)` | 挂载调试面板浮层，返回卸载函数 |
