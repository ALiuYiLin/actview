import { hydrate } from 'actview'
import { App } from './App'

declare global {
  interface Window {
    __INITIAL_DATA__?: unknown
  }
}

// 客户端水合：读取服务端注入的数据 → 与 SSR 相同的 props 渲染 → DOM 复用 + 事件绑定
const container = document.querySelector('#app')
if (!container) throw new Error('找不到 #app 容器')

hydrate(
  <App initialPosts={(window.__INITIAL_DATA__ ?? []) as never} />,
  container
)
