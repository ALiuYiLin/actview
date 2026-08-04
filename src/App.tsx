import { RouterLink, RouterView } from "@actview/router";
import { navStyle, linkStyle } from "./styles";

// ============================================================
// 根组件：标题 + 导航 + 路由出口
// ============================================================

export function App() {
  return (
    <div class="app"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "720px", margin: "0 auto", padding: "24px 16px", background: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        actview — 响应式前端框架检验页
      </h1>
      <nav style={navStyle}>
        <RouterLink style={linkStyle} to="/">首页</RouterLink>
        <RouterLink style={linkStyle} to="/reactive">① 响应式</RouterLink>
        <RouterLink style={linkStyle} to="/list">② keyed diff</RouterLink>
        <RouterLink style={linkStyle} to="/props">③ props</RouterLink>
        <RouterLink style={linkStyle} to="/toggle">④ 条件渲染</RouterLink>
      </nav>
      <RouterView />
      <p style={{ color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
        本页面由 actview 自身渲染 + @actview/router 路由驱动
      </p>
    </div>
  );
}
