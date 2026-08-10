import { createRouter, createWebHistory } from "@actview/router";
import { HomePage } from "./pages/HomePage";
import { ReactivePage } from "./pages/ReactivePage";
import { KeyedListPage } from "./pages/KeyedListPage";
import { PropsPage } from "./pages/PropsPage";
import { TogglePage } from "./pages/TogglePage";
import { ApiPage } from "./pages/ApiPage";
import { ArrayPage } from "./pages/ArrayPage";
import { SlotPage } from "./pages/SlotPage";
import { LifecyclePage } from "./pages/LifecyclePage";
import { DynamicPage } from "./pages/DynamicPage";
import { AsyncPage } from "./pages/AsyncPage";
import { IconPage } from "./pages/IconPage";
import { FallthroughPage } from "./pages/FallthroughPage";
import { ProvidePage } from "./pages/ProvidePage";
import { TestPage } from "./pages/TestPage";

// ============================================================
// 路由配置 — 路由切换 =》 组件切换
// ============================================================

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/reactive", component: ReactivePage },
    { path: "/list", component: KeyedListPage },
    { path: "/props", component: PropsPage },
    { path: "/toggle", component: TogglePage },
    { path: "/api", component: ApiPage },
    { path: "/array", component: ArrayPage },
    { path: "/slot", component: SlotPage },
    { path: "/lifecycle", component: LifecyclePage },
    { path: "/dynamic", component: DynamicPage },
    { path: "/async", component: AsyncPage },
    { path: "/icon", component: IconPage },
    { path: "/fallthrough", component: FallthroughPage },
    { path: "/provide", component: ProvidePage },
    { path: "/test", component: TestPage },
  ],
});
