import { createApp } from "@local/core";
import { App } from "./App";
// 副作用导入：router.ts 顶层 createRouter 即完成路由注册（currentRouter 单例）
import "./router";

// ============================================================
// 入口：挂载根组件（路由由 RouterView 通过 currentRouter 使用）
// ============================================================

createApp(App).mount("#app");
