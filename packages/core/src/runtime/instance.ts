// ============================================================
// 渲染器内部类型（@actview/core）
//
// 这里是 DOM 渲染器的实现契约：组件实例、AppContext、调度任务。
// 跨平台基础契约在 ../internal（Element / ClassComponentCtor /
// RenderFunction）；本文件在其上补充渲染器字段。
// ============================================================

import type { ClassComponentCtor, RenderFunction } from '../internal'
import type { VNode } from '../internal'
import type { EffectScope, ReactiveEffect } from '@actview/reactivity'
import type { ComponentScope } from './componentScope'

/** 应用配置（app.config） */
export interface AppConfig {
  /** 全部未捕获错误最终交给它；无实例时 instance 为 null */
  errorHandler?: ((
    err: unknown,
    instance: ComponentInternalInstance | null,
    info: string,
  ) => void) | null
  /** 开发期警告处理；不设置时使用 console.warn */
  warnHandler?: ((
    msg: string,
    instance?: ComponentInternalInstance | null,
    trace?: string,
  ) => void) | null
  /** 开启 renderer 性能采集（插件 / DevTools 使用） */
  performance?: boolean
  /** DevTools 接入开关；默认 __DEV__ */
  devtools?: boolean
}

/** 应用上下文：跨组件共享的全局信息 */
export interface AppContext {
  /** createApp 返回的 app 对象（避免循环依赖，用 unknown） */
  app: unknown
  /** 应用唯一 id（DevTools / 多应用区分） */
  appId: number
  /** 应用名（DevTools / 错误信息） */
  name?: string
  config: AppConfig
  /** app.provide 注入表（根组件 injects 的初始表） */
  provides: Record<PropertyKey, any>
  /** 当前挂载的根组件实例（未挂载为 null） */
  root: ComponentInternalInstance | null
}

/**
 * 组件公开实例（public instance proxy）。
 *
 * `app.mount()` / 组件 ref 暴露给用户的就是它；内部实例通过 `$` 访问，
 * 避免直接泄漏渲染器内部字段。
 */
export interface ComponentPublicInstance {
  /** 内部实例（调试 / 逃生口） */
  readonly $: ComponentInternalInstance
  readonly $props: Record<string, any>
  /** 组件子树根 DOM（组件渲染 null 时为 null） */
  readonly $el: Element | null
  readonly $parent: ComponentPublicInstance | null
  readonly $root: ComponentPublicInstance
  /** 强制重渲染（跳过 props 比较） */
  $forceUpdate: () => void
  /** 等当前更新刷盘（同 nextTick） */
  $nextTick: <T = void>(fn?: () => T) => Promise<T>
}

/** 生命周期钩子函数 */
export type Hook = () => void

/** 生命周期钩子类型（实例上的 hooks 数组字段名） */
export type LifecycleType =
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
  | 'activated'
  | 'deactivated'

/** 错误捕获钩子 */
export type ErrorCapturedHook = (err: unknown, instance: ComponentInternalInstance | null, info: string) => boolean | void

/** 调度任务（组件更新 / post flush 回调） */
export interface SchedulerJob {
  id?: number
  /** false 表示已失效（组件已卸载），flush 时跳过 */
  active?: boolean
  run: () => any
  /** 允许在自身执行期间再次入队（默认去重） */
  allowRecurse?: boolean
}

/** 组件实例（渲染器实现） */
export interface ComponentInternalInstance {
  uid: number
  /** 组件类型：@Component 类组件构造器 */
  type: ClassComponentCtor
  parent: ComponentInternalInstance | null
  appContext: AppContext
  vnode: VNode
  /** 类组件实例（第一版类组件路径使用；函数组件路径为 undefined） */
  ctx?: object
  /** props（shallowReactive：父写 props 触发子 render effect） */
  props: Record<string, any>
  /** setup 返回的 render 函数 */
  render: RenderFunction
  /** 当前子树（diff 的旧树） */
  subTree: VNode | null
  /** 组件级 render effect */
  effect: ReactiveEffect
  /** 更新任务（id = uid） */
  job: SchedulerJob
  /** 组件作用域：setup 期间的 watch/computed/render effect 统一停止 */
  scope: EffectScope
  /** 组件内 Model 作用域（每个组件实例一个；@UseModel 的缓存与生命周期） */
  modelScope?: ComponentScope
  /** 渲染次数（mount 为 1；DevTools / 性能面板） */
  renderCount: number
  isMounted: boolean
  /** 组件挂载的 DOM 容器（DOM 渲染器实现；跨平台渲染器可另立类型） */
  container: Element | null
  /** provide/inject 注入表（M2：provide 时 copy-on-write） */
  injects: Record<PropertyKey, any>
  /** 公开实例 proxy（组件 ref / app.mount 返回值） */
  proxy: ComponentPublicInstance
  /** 最近的 Suspense 上下文（Suspense 组件在 setup 阶段写入；async setup 用它注册） */
  suspenseCtx?: {
    register(): void
    resolve(): void
  }
  /** 触发一次组件更新（= queueJob(job)） */
  update: () => void
  beforeMount: Hook[]
  mounted: Hook[]
  beforeUpdate: Hook[]
  updated: Hook[]
  beforeUnmount: Hook[]
  unmounted: Hook[]
  activated: Hook[]
  deactivated: Hook[]
  errorCaptured: ErrorCapturedHook[]
}
