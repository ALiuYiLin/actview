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
import { ReactMigrationPage } from "./pages/react-migration/ReactMigrationPage";
import { PatternsPage } from "./pages/react-migration/PatternsPage";
import {
  UseCallbackPage,
  UseContextPage,
  UseEffectPage,
  UseIdPage,
  UseImperativeHandlePage,
  UseMemoPage,
  UseRefPage,
  UseStatePage,
} from "./pages/react-migration/MigrationDemos";
import {
  UseActionStatePage,
  UseDeferredValuePage,
  UseInsertionEffectPage,
  UseLayoutEffectPage,
  UseOptimisticPage,
  UseReducerPage,
  UseSyncExternalStorePage,
  UseTransitionPage,
} from "./pages/react-migration/PatternDemos";

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
    { path: "/react-migration", component: ReactMigrationPage },
    { path: "/react-migration/use-state", component: UseStatePage },
    { path: "/react-migration/use-ref", component: UseRefPage },
    { path: "/react-migration/use-effect", component: UseEffectPage },
    { path: "/react-migration/use-memo", component: UseMemoPage },
    { path: "/react-migration/use-callback", component: UseCallbackPage },
    { path: "/react-migration/use-context", component: UseContextPage },
    { path: "/react-migration/use-imperative-handle", component: UseImperativeHandlePage },
    { path: "/react-migration/use-id", component: UseIdPage },
    { path: "/react-patterns", component: PatternsPage },
    { path: "/react-patterns/use-reducer", component: UseReducerPage },
    { path: "/react-patterns/use-layout-effect", component: UseLayoutEffectPage },
    { path: "/react-patterns/use-insertion-effect", component: UseInsertionEffectPage },
    { path: "/react-patterns/use-sync-external-store", component: UseSyncExternalStorePage },
    { path: "/react-patterns/use-transition", component: UseTransitionPage },
    { path: "/react-patterns/use-deferred-value", component: UseDeferredValuePage },
    { path: "/react-patterns/use-optimistic", component: UseOptimisticPage },
    { path: "/react-patterns/use-action-state", component: UseActionStatePage },
  ],
});
