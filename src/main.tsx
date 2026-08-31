import { createApp } from "actview";
import { App } from "./App";
import { router } from "./router";

// ============================================================
// 入口：vue-router 插件注册 + 挂载根组件
// ============================================================

createApp(App).use(router).mount("#app");
