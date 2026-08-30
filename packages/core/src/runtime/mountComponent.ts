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

import { shallowReactive } from '../reactivity/reactive'
import { runEffect, queueJob, pauseTracking, resetTracking } from '../reactivity/reactive-system'
import { setCurrentInstance, getCurrentInstance } from './lifecycle'
import { getErrorBoundary } from './errorBoundary'
import { getCurrentSuspense } from './suspense'
import { getDevtoolsHook } from '../devtools'
import { EffectScope } from '../reactivity/effectScope'
import { extractScopedIdProps } from './scopedProps'
import type { VNode } from '../vnode'

let uid = 0

/** 重置组件 uid 计数（hydrate 入口调用：服务端/客户端遍历序对齐，useId 一致） */
export function resetComponentUid() {
  uid = 0
}

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
    parent?: any,
    anchor?: Node | null
  ) => void
  /** 模板引用回调（ref 指向组件实例） */
  applyRef: (ref: any, value: any) => void
  /** 挂载锚点：组件 vnode 在父容器中的插入位置（同索引 diff / keyed 传入），
   *  组件首次渲染 subtree 时用其定位（否则 append 到末尾破坏兄弟顺序） */
  anchor?: Node | null
  /** 组件 vnode 的后兄弟 vnode（父 children 里下一项）：subtree 首次渲染
   *  null（lazy 占位）后加载完成挂载时，用其 DOM 作锚点保持兄弟顺序 */
  nextSiblingVnode?: any
  /** 取 vnode 子树第一个真实 DOM（锚点求值，renderer 注入） */
  firstDomEl?: (vnode: any) => Node | null
  /** 水合上下文（hydrate 树沿挂载链传递）：游标 + 子树水合函数。
   *  组件首帧渲染不 patch（新建），改与既有 DOM 配对。 */
  hydrate?: { cursor: any; container: Element }
  /** 子树水合入口（由 hydrate 模块注入，避免 mountComponent ↔ hydrate 循环依赖） */
  hydrateVNode?: (vnode: any, container: Element, cursor: any, parent: any) => any
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
  /** 实例唯一 id（DevTools 用；SSR 遍历序与客户端一致 → useId 两端相同） */
  id: number
  /** useId 实例级调用计数（无全局共享状态，并发/多根安全） */
  __idSeq?: { value: number }
  /** 组件名（DevTools 用） */
  name: string
  /** 普通对象 props：由父组件 patch 时更新值并手动调用 update() */
  props: any
  /** 父组件实例（provide/inject 链） */
  parent: ComponentInstance | null
  /** 注入表：未调用 provide 时共享父引用（零拷贝）；首次 provide 时 copy-on-write */
  injects: Record<PropertyKey, any>
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
    // React 语义：无 ErrorBoundary 处理时渲染错误向上抛出（对齐 React 18
    // 根渲染错误抛给挂载调用者；Vue 默认吞掉，但 Base UI 移植测试依赖
    // render 的 Promise reject 才能捕获 setup/render 抛错）
    throw err
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
  // 组件 setup：{ __setup } 对象，或裸函数（未经 Babel 转换的运行时兜底——
  // 与 renderToString 判定一致；裸函数调用一次按 setup 语义执行）
  const setup =
    typeof options === 'function' ? options : (options?.__setup as any)
  if (typeof setup !== 'function') {
    throw new Error(
      '[actview] mountComponent: 无效的组件，缺少 __setup（组件需经 Babel 插件转换或使用 defineComponent）',
    )
  }

  // props 全量（key/ref 除外）：shallowReactive 代理（对齐 Vue 3）——
  // computed(() => props.x) / watch(() => props.x) 可追踪 props 变化；
  // 父组件 patchComponent → updateProps 写代理触发依赖，自动重算重渲染。
  // 手动 instance.update() 保留为双保险（jobQueue Set 去重，不双渲染）。
  // 组件边界 scoped 转换：注入形态的 data-v-*（值为 ''）合并为 scopedId prop
  // （ActView 无透传，子组件手动引用），代理创建前完成避免多余的响应式写入。
  const rawProps = { ...(vnode.props || {}) }
  extractScopedIdProps(rawProps)
  const props = shallowReactive(rawProps)
  // 保留 props.ref：React 19 风格 ref-as-prop——函数式组件（defineComponent）可
  // 从 props 解构 ref 并手动转发到底层元素（等价 React.forwardRef）。
  // 同时 mountComponent 仍执行 applyRef(props.ref, instance)（Vue 语义兜底），
  // 组件内部转发回调会在子树渲染时覆盖为真实 DOM。
  delete props.key

  const instance: ComponentInstance = {
    setup: setup,
    id: ++uid,
    __idSeq: { value: 0 },
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

  // setup 执行期间挂载 currentInstance 上下文（栈式管理，对齐 Vue）：
  // 组件内调用 onMounted / onUpdated / onBeforeUnmount / provide 坉注册到本实例。
  // 窗口退出必须还原【进入前的值】而非硬置 null——挂载常同步嵌套在父组件渲染
  // 中途发生：硬置 null 会把父的上下文清掉，父继续渲染后续子树/接线时
  // getCurrentInstance() 失效（历史缺陷）。prev-restore 后与调用栈天然成对。
  // pauseTracking：setup 在父组件渲染 effect 上下文中同步执行（挂载发生在父渲染
  // 期间），若 setup 内直接读响应式 props（如快照 const），会把父 effect 污染性
  // 地订阅到本组件 props（写入 → 父重渲染 → 自激循环）。computed/watch 的惰性
  // 求值在各自 effect.run() 内强制恢复追踪，不受影响（对齐 invokeHooks 语义）。
  const prevInstance = getCurrentInstance()
  setCurrentInstance(instance)
  pauseTracking()
  let setupResult: any
  try {
    setupResult = setup(props, {
      // live getter：provide 拷贝后 ctx.injects 实时指向最新注入表
      // （若传快照引用，组件自己 provide 后再读 ctx.injects 会拿到旧表）
      get injects() {
        return instance.injects
      }
    })
  } finally {
    resetTracking()
    setCurrentInstance(prevInstance)
  }

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
  } else if (typeof setupResult === 'function') {
    instance.render = setupResult
  } else {
    // setup 返回了 VNode 而非 render 函数：裸函数组件未经 Babel 转换的典型症状
    // （融合式 setup+render 无法在运行时区分阶段，给出明确报错替代后续
    // "instance.render is not a function"）
    throw new Error(
      '[actview] 组件 setup 必须返回 render 函数。' +
        (typeof options === 'function'
          ? '裸函数组件需经 Babel 插件转换（最后 return JSX），或手动返回 () => JSX。收到：' +
            typeof setupResult
          : 'defineComponent 的 setup 需返回 () => JSX（收到 ' + typeof setupResult + '）'),
    )
  }

  // 更新函数：重新 render 并与旧子树 patch
  // 渲染期实例上下文（对齐 Vue currentRenderingInstance 渲染窗口）：进入前置为
  // 当前实例、退出还原 prev——渲染期内 getCurrentInstance() 可用（后续功能如
  // 运行时插槽出口等的基础）；首次挂载与重渲染共用本闭包（runEffect 首跑即过）。
  const update = () => {
    const wasMounted = instance.isMounted
    const prevRenderInstance = getCurrentInstance()
    setCurrentInstance(instance)
    try {
      const newSubTree = instance.render()
      // 组件渲染返回数组（多 children / slot 数组，如 <Provider>{props.children}</Provider>
      // 且 children 为多个子元素）时包装为 Fragment——否则 mountVNode(数组) 会把数组
      // 当元素类型渲染出 <undefined> 占位（对齐 React：组件返回数组等价于 Fragment）
      const normalizedSubTree = Array.isArray(newSubTree)
        ? {
            $$typeof: Symbol.for('react.element'),
            type: Symbol.for('react.fragment'),
            key: null,
            ref: null,
            props: {children: newSubTree},
          }
        : newSubTree
      const oldSubTree = instance.subTree
      instance.subTree = normalizedSubTree
      // 子树 children 的父实例 = 本组件实例（子组件 provide/inject 继承来源）
      // 水合首帧：不新建 DOM，与既有 DOM 配对（游标推进）；后续更新走正常 patch
      if (deps.hydrateVNode && !instance.isMounted) {
        deps.hydrateVNode(
          normalizedSubTree,
          deps.hydrate!.container,
          deps.hydrate!.cursor,
          instance
        )
      } else {
        // 组件子树挂载锚点：
        //  - 首次渲染（isMounted=false）：用挂载锚点 deps.anchor（外层传入）
        //  - 后续 subtree 从 null → 实节点（lazy 加载完成）：用后兄弟 vnode
        //    的 DOM（按 vnode 延迟求值，兄弟未挂载则 null → append）
        // 否则 [lazy, div, lazy] 会渲染成 [div, lazy, lazy]（append 末尾）
        const anchor =
          oldSubTree == null && !instance.isMounted
            ? deps.anchor ?? null
            : deps.nextSiblingVnode && deps.firstDomEl
              ? deps.firstDomEl(deps.nextSiblingVnode)
              : null
        deps.patch(
          oldSubTree,
          normalizedSubTree,
          container as Element,
          undefined,
          instance,
          anchor
        )
      }
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
    } finally {
      setCurrentInstance(prevRenderInstance)
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
  // 同步挂载顺序：子树先挂载完成 → 子 mounted 先于父组件触发。
  // 与 Vue 3 一致（Vue 的 mounted 经 post-flush 队列，子先入队先执行；
  //  父先子后的是 beforeMount——官方断言见 vue3 runtime-core
  //  __tests__/apiLifecycle.spec.ts：child onMounted → root onMounted）
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
