import { RouterLink } from "@actview/router";
import { cardStyle, linkStyle } from "../styles";

// ============================================================
// 首页 — 框架能力总览
// ============================================================

export function HomePage() {
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>框架能力总览</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        actview 是一个从零实现的响应式前端框架：自研 JSX runtime + Babel 编译插件 +
        响应式系统 + 组件模型。本页由框架自身渲染，通过路由切换体验各能力。
      </p>
      <div>
        <RouterLink style={linkStyle} to="/reactive">① 响应式更新</RouterLink>
        <RouterLink style={linkStyle} to="/list">② keyed diff</RouterLink>
        <RouterLink style={linkStyle} to="/props">③ props 细粒度更新</RouterLink>
        <RouterLink style={linkStyle} to="/toggle">④ 条件渲染</RouterLink>
      </div>
    </div>
  );
}
