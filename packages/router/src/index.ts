// ============================================================
// @actview/router — 仿 Vue Router 最小版
//   路由切换 =》 组件切换，无守卫/懒加载等能力
// ============================================================

export { createRouter, currentRouter } from './router'
export type { Router, RouterOptions, RouteLocation, RouteLocationRaw } from './router'

export { createMemoryHistory, createWebHistory } from './history'
export type { RouterHistory } from './history'

export type { RouteRecord, MatchedRoute } from './matcher'

export { RouterLink, RouterView } from './components'
