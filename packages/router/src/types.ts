// ============================================================
// @actview/router — 类型
// ============================================================

import type { ClassComponent } from '@actview/core'
import type { RouterHistory } from './history'

export type RouteComponent =
  | ClassComponent<any>
  | (() => Promise<{ default?: ClassComponent<any> } | ClassComponent<any>>)

export type RouteParams = Record<string, string | number | string[]>

export interface RouteLocationRawObject {
  path?: string
  name?: string
  params?: RouteParams
  query?: Record<string, string | number | boolean | null | undefined | Array<string | number>>
  hash?: string
  replace?: boolean
}

export type RouteLocationRaw = string | RouteLocationRawObject

export interface RouteRecordRaw {
  path: string
  name?: string
  component?: RouteComponent
  redirect?: RouteLocationRaw
  children?: RouteRecordRaw[]
  meta?: Record<string, any>
  /** true → 把 params 作为 props；对象 / 函数也支持 */
  props?: boolean | Record<string, any> | ((to: RouteLocationNormalized) => Record<string, any>)
  beforeEnter?: NavigationGuard | NavigationGuard[]
}

export interface RouteRecord {
  path: string
  name?: string
  component?: ClassComponent<any>
  redirect?: RouteLocationRaw
  children: RouteRecord[]
  parent: RouteRecord | null
  /** 从根到当前记录的链 */
  matched: RouteRecord[]
  meta: Record<string, any>
  props?: RouteRecordRaw['props']
  beforeEnter: NavigationGuard[]
  regex: RegExp
  keys: string[]
  score: number
}

export interface RouteLocationNormalized {
  path: string
  fullPath: string
  name?: string
  params: Record<string, string>
  query: Record<string, string | string[]>
  hash: string
  matched: RouteRecord[]
  meta: Record<string, any>
  redirect?: RouteLocationRaw
}

export type NavigationGuardResult =
  | boolean
  | void
  | RouteLocationRaw

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => NavigationGuardResult | Promise<NavigationGuardResult>

export interface NavigationResult {
  ok: boolean
  aborted?: boolean
  redirected?: boolean
}

export interface ScrollPosition {
  left: number
  top: number
}

export interface RouterOptions {
  history: RouterHistory
  routes: RouteRecordRaw[]
  scrollBehavior?: (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    savedPosition: ScrollPosition | null,
  ) => ScrollPosition | void
}
