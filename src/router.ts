import { createRouter, createWebHistory } from "@actview/router";
import { HomePage } from "./pages/HomePage";

// ============================================================
// 路由配置 — 路由切换 =》 组件切换
//
// 懒加载：除首页外全部动态 import（按路由分包，进页面才拉取 chunk）。
// 页面为命名导出，RouterView 的 lazy() 需要 { default } 形态，故用
// .then((m) => ({ default: m.XxxPage })) 包装；首次导航显示 Suspense fallback。
//
// 嵌套：/react-migration 与 /react-patterns 为父布局（简介 + 子导航 +
// 嵌套 <RouterView/> 出口），hook demo 挂 children；/react-migration
// 精确路径由 path:'' 索引子路由渲染速查表。URL 与扁平结构完全一致。
// ============================================================

const lazyPage =
  (load: () => Promise<any>, pick: (m: any) => any) =>
  () =>
    load().then((m) => ({ default: pick(m) }));

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/reactive", component: lazyPage(() => import("./pages/ReactivePage"), (m) => m.ReactivePage) },
    { path: "/list", component: lazyPage(() => import("./pages/KeyedListPage"), (m) => m.KeyedListPage) },
    { path: "/props", component: lazyPage(() => import("./pages/PropsPage"), (m) => m.PropsPage) },
    { path: "/toggle", component: lazyPage(() => import("./pages/TogglePage"), (m) => m.TogglePage) },
    { path: "/api", component: lazyPage(() => import("./pages/ApiPage"), (m) => m.ApiPage) },
    { path: "/array", component: lazyPage(() => import("./pages/ArrayPage"), (m) => m.ArrayPage) },
    { path: "/slot", component: lazyPage(() => import("./pages/SlotPage"), (m) => m.SlotPage) },
    { path: "/lifecycle", component: lazyPage(() => import("./pages/LifecyclePage"), (m) => m.LifecyclePage) },
    { path: "/dynamic", component: lazyPage(() => import("./pages/DynamicPage"), (m) => m.DynamicPage) },
    { path: "/async", component: lazyPage(() => import("./pages/AsyncPage"), (m) => m.AsyncPage) },
    { path: "/icon", component: lazyPage(() => import("./pages/IconPage"), (m) => m.IconPage) },
    { path: "/fallthrough", component: lazyPage(() => import("./pages/FallthroughPage"), (m) => m.FallthroughPage) },
    { path: "/provide", component: lazyPage(() => import("./pages/ProvidePage"), (m) => m.ProvidePage) },
    { path: "/test", component: lazyPage(() => import("./pages/TestPage"), (m) => m.TestPage) },
    {
      path: "/react-migration",
      component: lazyPage(() => import("./pages/react-migration/ReactMigrationPage"), (m) => m.ReactMigrationPage),
      children: [
        { path: "", component: lazyPage(() => import("./pages/react-migration/ReactMigrationPage"), (m) => m.ReactMigrationOverview) },
        { path: "use-state", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseStatePage) },
        { path: "use-ref", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseRefPage) },
        { path: "use-effect", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseEffectPage) },
        { path: "use-memo", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseMemoPage) },
        { path: "use-callback", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseCallbackPage) },
        { path: "use-context", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseContextPage) },
        { path: "use-imperative-handle", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseImperativeHandlePage) },
        { path: "use-id", component: lazyPage(() => import("./pages/react-migration/MigrationDemos"), (m) => m.UseIdPage) },
      ],
    },
    {
      path: "/react-patterns",
      component: lazyPage(() => import("./pages/react-migration/PatternsPage"), (m) => m.PatternsPage),
      children: [
        { path: "use-reducer", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseReducerPage) },
        { path: "use-layout-effect", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseLayoutEffectPage) },
        { path: "use-insertion-effect", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseInsertionEffectPage) },
        { path: "use-sync-external-store", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseSyncExternalStorePage) },
        { path: "use-transition", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseTransitionPage) },
        { path: "use-deferred-value", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseDeferredValuePage) },
        { path: "use-optimistic", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseOptimisticPage) },
        { path: "use-action-state", component: lazyPage(() => import("./pages/react-migration/PatternDemos"), (m) => m.UseActionStatePage) },
      ],
    },
  ],
});
