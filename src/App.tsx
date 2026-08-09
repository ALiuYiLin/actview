import { RouterLink, RouterView } from "@actview/router";
import './index.css?scoped'

// ============================================================
// 根组件：标题 + 导航 + 路由出口
// 样式已移至 index.css（scoped，见 .app / .app h1 / .app nav / :deep(a)）
// ============================================================

export function App() {
  return (
    <div class="app">
      <h1>
        actview — 响应式前端框架检验页
      </h1>
      <nav>
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/reactive">① 响应式</RouterLink>
        <RouterLink to="/list">② keyed</RouterLink>
        <RouterLink to="/props">③ props</RouterLink>
        <RouterLink to="/toggle">④ 条件</RouterLink>
        <RouterLink to="/api">⑤ API</RouterLink>
        <RouterLink to="/array">⑥ 数组</RouterLink>
        <RouterLink to="/slot">⑦ 插槽</RouterLink>
        <RouterLink to="/lifecycle">⑧ 生命周期</RouterLink>
        <RouterLink to="/dynamic">⑨ 动态</RouterLink>
        <RouterLink to="/async">⑩ 异步</RouterLink>
        <RouterLink to="/icon">⑪ 图标</RouterLink>
      </nav>
      <RouterView />
      <p>
        本页面由 actview 自身渲染 + @actview/router 路由驱动
      </p>
    </div>
  );
}
