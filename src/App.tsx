import { Suspense } from "actview";
import { RouterLink, RouterView } from "@actview/router";
import './index.css?scoped'

// ============================================================
// 根组件：标题（点击返回首页）+ 路由出口（路由清单统一在首页列出）
// 路由组件为懒加载动态 import，Suspense 提供首次加载 fallback
// 样式已移至 index.css（scoped，见 .app / .app h1）
// ============================================================

export function App({x1}:{x1?:any}) {
  console.log('x1: ', x1);
  return (
    <div class="app">
      <h1>
        <RouterLink to="/" style={{ color: "inherit", textDecoration: "none" }} title="返回首页">
          actview — 响应式前端框架检验页
        </RouterLink>
      </h1>
      <Suspense fallback={<p style={{ color: "#94a3b8", fontSize: 13 }}>页面加载中…</p>}>
        <RouterView />
      </Suspense>
      <p>
        本页面由 actview 自身渲染 + @actview/router 路由驱动
      </p>
    </div>
  );
}
