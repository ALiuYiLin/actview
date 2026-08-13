// ============================================================
// 组件挂载 — 用户思路的核心
//   const render = __setup(props)      // props 为普通对象（全量，key/ref 除外）
//   runEffect(() => {
//     const newVnode = render()
//     patch(oldVnode, newVnode)   // 响应式变化时自动执行
//   })
// 语义对齐 React：setup(props) 收到全部传入属性，无 props/attrs 分离、
// 无自动透传（用户显式 {...props} 选择继承）。
// ============================================================

import {
  runEffect,
  queueJob,
  pauseTracking,
  resetTracking
} from '../reactivity/reactive-system'
import { setCurrentInstance } from './lifecycle'
import { getErrorBoundary } from './errorBoundary'
import { getCurrentSuspense } from './suspense'
import { getDevtoolsHook } from '../devtools'
import { EffectScope } from '../reactivity/effectScope'
import type { VNode } from '../vnode'

let uid = 0

/**
 * renderer 注入的渲染依赖（消除 renderer ↔ mountComponent 循环依赖）：
 * mountComponent 不 import './renderer'，改由 renderer 挂载组件时传入自身
 * 的 patch / applyRef。ESM 环 → 单向依赖（renderer → mountComponent）。
 */
export interface RendererDeps {
  /** 子树 patch（组件 update 时与旧子树 diff） */
  patch: (
    oldVnode: any,
    newVnode: any,
    container: Element,
    index?: number,
    parent?: any
  ) => void
  /** 模板引用回调（ref 指向组件实例） */
  applyRef: (ref: any, value: any) => void
}

/**
 * 触发生命周期钩子：暂停依赖收集。
 * 钩子在组件 effect 的 run 上下文内同步执行，若钩子里读写响应式
 * （如 onUpdated 里 count++），`++` 的读会把该响应式 track 进组件渲染 effect，
 * 写时触发自身 =》 无限循环。Vue 3 的钩子在 post 队列执行（activeEffect 为 null）
 * 天然无此问题 —— 这里用 pauseTracking 对齐该语义。
 */
export function invokeHooks(hooks: (() => void)[]) {
  if (!hooks.length) return
  pauseTracking()
  try {
    hooks.forEach((fn) => fn())
  } finally {
    resetTracking()
  }
}

/** 组件实例：保存 setup/render 及当前子树 */
export interface ComponentInstance {
  setup: (props: any) => () => any
  /** 实例唯一 id（DevTools 用） */
  id: number
  /** 组件名（DevTools 用） */
  name: string
  /** 普通对象 props：由父组件 patch 时更新值并手动调用 update() */
  props: any
  /** 父组件实例（provide/inject 链） */
  parent: ComponentInstance | null
  /** 注入表：未调用 provide 时共享父引用（零拷贝）；首次 provide 时 copy-on-write */
  injects: Record<string, any>
  render: () => any
  subTree: VNode | null
  update: () => void
  unmount: () => void
  /** 是否已完成首次挂载（区分 mounted / updated） */
  isMounted: boolean
  /** 挂载容器（keep-alive 恢复 DOM 时使用） */
  container: Element | null
  /** 实例 effect 是否仍存活（被卸载后 false；缓存复用判断用） */
  isActive: () => boolean
  /** 组件 effect scope：setup 期间的 watch/computed/render effect 注册于此，卸载时统一停止 */
  scope: EffectScope
  /** 生命周期钩子数组（setup 执行期间注册） */
  beforeMount: (() => void)[]
  mounted: (() => void)[]
  updated: (() => void)[]
  beforeUnmount: (() => void)[]
  unmounted: (() => void)[]
  activated: (() => void)[]
  deactivated: (() => void)[]
  errorCaptured: ((err: any) => boolean | void)[]
  serverPrefetch: (() => Promise<any> | any)[]
  renderTracked: ((e: any) => void)[]
  renderTriggered: ((e: any) => void)[]
}

/** 沿组件树向上处理渲染错误：先走 onErrorCaptured，再交给 ErrorBoundary */
export function handleError(instance: ComponentInstance, err: any) {
  let cur: ComponentInstance | null = instance
  while (cur) {
    const hooks = cur.errorCaptured
    if (hooks && hooks.length) {
      for (const hook of hooks) {
        const result = hook(err)
        if (result === false) return // 已处理，停止向上传播
      }
    }
    cur = cur.parent
  }
  const boundary = getErrorBoundary()
  if (boundary && boundary.errorRef?.value == null) {
    boundary.errorRef.value = err
    boundary.update?.()
  } else {
    console.error('[actview] 组件渲染错误:', err)
  }
}

/** 挂载组件 VNode：实例化并建立响应式更新 effect（deps 由 renderer 注入） */
export function mountComponent(
  vnode: any,
  container: Element | null,
  parentInstance: ComponentInstance | null | undefined,
  deps: RendererDeps
) {
  const options = vnode.type
  if (
    options == null ||
    typeof options !== 'object' ||
    typeof options.__setup !== 'function'
  ) {
    throw new Error('[actview] mountComponent: 无效的组件，缺少 __setup')
  }

  // props 全量（key/ref 除外）：普通对象，父组件通过 patchComponent 更新值 + 手动 update()
  const props = { ...(vnode.props || {}) }
  delete props.ref
  delete props.key

  const instance: ComponentInstance = {
    setup: options.__setup,
    id: ++uid,
    name: options.name || 'Anonymous',
    props,
    parent: parentInstance ?? null,
    injects: parentInstance?.injects ?? {},
    render: null as unknown as () => any,
    subTree: null,
    update: () => {},
    unmount: () => {},
    isMounted: false,
    container: container as Element | null,
    isActive: () => false,
    scope: new EffectScope(),
    beforeMount: [],
    mounted: [],
    updated: [],
    beforeUnmount: [],
    unmounted: [],
    activated: [],
    deactivated: [],
    errorCaptured: [],
    serverPrefetch: [],
    renderTracked: [],
    renderTriggered: []
  }
  vnode.component = instance

  // 组件模板引用：ref 指向组件实例
  deps.applyRef(vnode.props?.ref, instance)

  // setup 执行期间挂载 currentInstance 上下文：
  // 组件内调用 onMounted / onUpdated / onBeforeUnmount / provide 均注册到本实例
  setCurrentInstance(instance)
  const setupResult = options.__setup(props, {
    // live getter：provide 拷贝后 ctx.injects 实时指向最新注入表
    // （若传快照引用，组件自己 provide 后再读 ctx.injects 会拿到旧表）
    get injects() {
      return instance.injects
    }
  })
  setCurrentInstance(null)

  if (setupResult && typeof setupResult.then === 'function') {
    // 异步 setup（返回 Promise<render>）：向最近 Suspense 注册，占位渲染 null
    const suspense = getCurrentSuspense()
    suspense?.suspenseCtx?.register()
    instance.render = () => null
    setupResult.then((render: any) => {
      instance.render = render
      suspense?.suspenseCtx?.resolve()
      instance.update()
    })
  } else {
    instance.render = setupResult
  }

  // 更新函数：重新 render 并与旧子树 patch
  const update = () => {
    const wasMounted = instance.isMounted
    try {
      const newSubTree = instance.render()
      const oldSubTree = instance.subTree
      instance.subTree = newSubTree
      // 子树 children 的父实例 = 本组件实例（子组件 provide/inject 继承来源）
      deps.patch(oldSubTree, newSubTree, container as Element, undefined, instance)
      // 刷新组件 VNode 的 el（子树根可能因条件渲染而改变）
      vnode.el = instance.subTree ? instance.subTree.el : null
      // 钩子：首次渲染后进入 mounted 态，之后每次重渲染触发 updated
      if (instance.isMounted) {
        invokeHooks(instance.updated)
      } else {
        instance.isMounted = true
      }
    } catch (err) {
      // 渲染错误：沿组件树走 onErrorCaptured，再交给 ErrorBoundary
      handleError(instance, err)
    }
    // DevTools 埋点：首次渲染 = 挂载，之后 = 更新
    const dth = getDevtoolsHook()
    if (dth) {
      const info = {
        id: instance.id,
        name: instance.name,
        instance,
        parent: instance.parent
      }
      if (wasMounted) dth.onComponentUpdate?.(info)
      else dth.onComponentMount?.(info)
    }
  }

  // 首次挂载前触发 onBeforeMount（首次 render 之前）
  invokeHooks(instance.beforeMount)

  // runEffect 立即执行首次挂载（同步渲染）；之后响应式变化经 scheduler
  // 入微任务队列去重批量更新（调度批处理）
  // render effect 注册进组件 scope，随组件卸载自动停止
  const effect = instance.scope.run(() =>
    runEffect(update, { scheduler: queueJob, instance })
  )

  // 首次渲染已完成（DOM 已挂载）→ 触发 onMounted
  // 注意：子组件的 mounted 先于父组件触发（同步挂载顺序，与 Vue 3 相反）
  invokeHooks(instance.mounted)

  // props 更新路径（父组件 patchComponent 手动调度）同样入队，
  // 获得 cleanup + 正确 activeEffect 上下文 + 批处理语义；
  // 裸调用 update 会把调用方（父 effect）误收集进本组件的内部响应式依赖
  instance.update = () => {
    if (effect.active) queueJob(effect)
  }

  instance.isActive = () => effect.active

  instance.unmount = () => {
    invokeHooks(instance.beforeUnmount)
    // 停止组件作用域内全部 effect（render effect + setup 期间的 watch/computed）
    instance.scope.stop()
    effect.stop() // 兜底（scope.stop 已含 render effect，幂等）
    // unmounted：卸载完成后触发（Vue 3 语义：在 beforeUnmount 之后）
    invokeHooks(instance.unmounted)
    // DevTools 埋点：卸载
    getDevtoolsHook()?.onComponentUnmount?.({
      id: instance.id,
      name: instance.name,
      instance,
      parent: instance.parent
    })
  }

  // 组件 VNode 的 el 指向其子树根节点
  vnode.el = instance.subTree ? instance.subTree.el : null
}
