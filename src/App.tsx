import { RouterView } from "@actview/router";
import './index.css?scoped'

// ============================================================
// 根组件：标题 + 路由出口（路由清单统一在首页列出）
// 样式已移至 index.css（scoped，见 .app / .app h1）
// ============================================================

export function App({x1}:{x1?:any}) {
  console.log('x1: ', x1);
  return (
    <div class="app">
      <h1>
        actview — 响应式前端框架检验页
      </h1>
      <RouterView />
      <p>
        本页面由 actview 自身渲染 + @actview/router 路由驱动
      </p>
    </div>
  );
}
