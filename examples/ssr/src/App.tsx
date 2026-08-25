import { ref, useId } from 'actview'
import type { Post } from './data'

/**
 * 演示组件：SSR 与客户端首帧完全一致（props.initialPosts 由两端同一数据注入，
 * count 初始 0）→ 水合无 mismatch，DOM 复用，事件即绑即用。
 */
export function App(props: { initialPosts: Post[] }) {
  const count = ref(0)
  const uid = useId()
  const posts = ref(props.initialPosts)

  return () => (
    <div class="app">
      <h1 class="title" data-uid={uid}>
        ActView SSR Demo
      </h1>
      <p class="sub">服务端渲染 HTML → 客户端水合（DOM 复用，无闪烁）</p>

      <section class="card">
        <h2>水合后事件即用</h2>
        <p class="hint">点击按钮——页面加载完成即可交互，无需重建</p>
        <div class="row">
          <button class="inc" onClick={() => count.value++}>
            +1
          </button>
          <span class="val">{count.value}</span>
          <button class="reset" onClick={() => (count.value = 0)}>
            归零
          </button>
        </div>
      </section>

      <section class="card">
        <h2>服务端预取数据（__INITIAL_DATA__ 注入）</h2>
        <p class="hint">
          服务端 await fetchPosts() → 注入 window.__INITIAL_DATA__ → 客户端 hydrate
          时经 props 传入 → 两端首帧一致
        </p>
        <ul class="posts">
          {posts.value.map((p) => (
            <li key={p.id} class="post">
              <strong>{p.title}</strong>
              <span>{p.excerpt}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
