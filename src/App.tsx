import { Router, RouterView } from "@actview/router"
import { Menu, MenuGroup } from "./components/menu"

const menus: MenuGroup[] = [
  { group: "导航", items: [{ path: "/home", label: "首页", icon: "🏠" }] },
  {
    group: "示例",
    items: [{ path: "/not-found", label: "404 页面", icon: "🚫" }],
  },
  {
    group: "调试",
    items: [
      { path: "/bugs", label: "Bug 演示", icon: "🐛" },
      { path: "/demo", label: "组件写法", icon: "📖" },
      { path: "/guide", label: "指南", icon: "📘" },
      { path: "/test-a", label: "TestA", icon: "🧪" },
      { path: "/test-b", label: "TestB", icon: "🧪" },
    ],
  },
  {
    group: "组件",
    path: "/component",
    items: [
      { path: "/component/button", label: "按钮", icon: "🔘" },
      { path: "/component/switch", label: "开关", icon: "🔛" },
      { path: "/component/input", label: "输入框", icon: "📝" },
    ],
  },
]

export function App() {
  const router = Router.getInstance()

  return () => (
    <div id="app-root">
      <nav id="navbar">
        <div class="nav-links" style="display:flex;gap:24px;">
          <a
            class={router.route.value?.path === "/home" ? "active" : ""}
            onClick={(e: MouseEvent) => { e.preventDefault(); router.push("/home") }}
            href="/home"
          >Home</a>
          <a
            class={router.route.value?.path === "/not-found" ? "active" : ""}
            onClick={(e: MouseEvent) => { e.preventDefault(); router.push("/not-found") }}
            href="/not-found"
          >Not Found</a>
        </div>
      </nav>
      <div id="app-main">

      <div id="sidebar">
        <Menu menus={menus} router={router} />
      </div>
      <main id="app-content">
        <p style="margin-bottom:12px;color:#999;font-size:13px;">
          当前路由：{router.route.value?.path}
        </p>
        <RouterView />
      </main>
      </div>
    </div>
  )
}
