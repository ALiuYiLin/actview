import { Router, RouterView } from "@actview/router"
import { Menu, MenuGroup } from "./components/menu"

const menus: MenuGroup[] = [
  { group: "导航", items: [{ path: "/home", label: "首页", icon: "🏠" }] },
  {
    group: "调试",
    items: [
      { path: "/demo", label: "组件写法", icon: "📖" },
      { path: "/guide", label: "指南", icon: "📘" },
    ],
  },
]

export function App() {
  const router = Router.getInstance()

  return () => (
    <div id="app-root">
      <nav id="navbar">
        <div class="logo">ActView</div>
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
      <main id="content">
        <p style="margin-bottom:12px;color:#999;font-size:13px;">
          当前路由：{router.route.value?.path}
        </p>
        <RouterView />
      </main>
      </div>
    </div>
  )
}
