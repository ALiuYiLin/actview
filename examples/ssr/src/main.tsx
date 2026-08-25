import { hydrate } from 'actview'
import { App } from './App'

declare global {
  interface Window {
    __INITIAL_DATA__?: unknown
  }
}

// 客户端水合入口：读取服务端注入的数据 → 与 SSR 相同的 props 渲染 →
// DOM 复用 + 事件绑定（本文件顶层 JSX 非组件函数，不经 defineComponent 转换，
// 由 vite esbuild 按 jsxImportSource: @actview/jsx 编译）
const container = document.querySelector('#app')
if (!container) throw new Error('找不到 #app 容器')

hydrate(
  <App initialPosts={(window.__INITIAL_DATA__ ?? []) as never} />,
  container
)
