import { Router, RouterView } from "@actview/router"
import { Menu, MenuGroup } from "./components/menu"

const menus: MenuGroup[] = [
  {
    group: "指南",
    items: [
      { path: "/reactive-demo", label: "响应式基础", icon: "⚡" },
      { path: "/computed-demo", label: "计算与侦听", icon: "📡" },
      { path: "/jsx-demo", label: "JSX 渲染", icon: "🖼️" },
      { path: "/components-demo", label: "组件", icon: "🧩" },
      { path: "/slot-demo", label: "插槽", icon: "📥" },
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
