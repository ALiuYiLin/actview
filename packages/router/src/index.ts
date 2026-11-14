// ============================================================
// @actview/router — 公开入口
// ============================================================

export { Router, createRouter, routerKey, viewDepthKey } from './router'
export {
  createWebHistory,
  createWebHashHistory,
  createMemoryHistory,
} from './history'
export { RouterView, RouterLink } from './components'
export type {
  NavigationGuard,
  NavigationGuardResult,
  NavigationResult,
  RouteComponent,
  RouteLocationNormalized,
  RouteLoader,
  RouteLocationRaw,
  RouteLocationRawObject,
  RouteParams,
  RouteRecord,
  RouteRecordRaw,
  RouterOptions,
  ScrollPosition,
} from './types'
export type { RouterHistory } from './history'
