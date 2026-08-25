import type { ComponentInstance } from './mountComponent'
import { ref, type Ref } from '../reactivity/ref'

// ============================================================
// 生命周期钩子 — 模块级 currentInstance 上下文
//   只能在组件 setup 中调用（setup 执行期间 currentInstance 指向该组件实例）
//   setCurrentInstance 同时激活/恢复组件的 effect scope：
//   setup 期间创建的 watch/computed 注册进组件 scope，卸载时自动停止
// ============================================================

let currentInstance: ComponentInstance | null = null

export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance
}

// ============================================================
// useId — 生成稳定的唯一 id（React useId 的可用场景）
//   客户端：基于组件实例自增 id（mountComponent uid；setup 只执行一次 →
//   每次重渲染间 id 稳定）+ 实例级调用计数（__idSeq，同组件多次调用不冲突）。
//   SSR：renderToString 分配遍历序 ssrInstance.id + 实例级 __idSeq ——
//   与客户端 hydrate（uid 重置后遍历序）一致 → 服务端/客户端 id 相同。
//   实例级计数（非全局）→ 并发请求/多根均无共享状态，天然安全。
//   setup 外调用：回退全局计数（静态序列化兜底）。
// ============================================================

let useIdSeq = 0

/** 重置全局 useId 计数（兜底；实例级计数场景无需调用） */
export function resetIdState() {
  useIdSeq = 0
}

export function useId(): string {
  const instance = getCurrentInstance() as
    | (ComponentInstance & { __idSeq?: { value: number } })
    | null
  const base = instance?.id != null ? instance.id : 's'
  const seq = instance?.__idSeq ? ++instance.__idSeq.value : ++useIdSeq
  return `actview-id-${base}-${seq}`
}

// ============================================================
// useRootElement — 组件根 DOM 引用（ref 契约恒为根 DOM）
//   无头组件（Base UI 风格）在 render 分支可变时（元素/组件/用户 JSX），
//   模板 ref 在"根是组件"时会给组件实例（PD-02 语义）而非 DOM；
//   subTree.el 沿挂载链传播到最终根 DOM（组件 vnode.el = 子树根 el），
//   对任意嵌套深度都收敛——本 API 封装该推导 + 生命周期同步。
//   返回**可变 ref**：用户 {…props} 展开成模板 ref 时要写 .value，
//   只读 getter 伪 ref 会在严格模式抛错，故必须可变。
// ============================================================

export function useRootElement(): Ref<HTMLElement | null> {
  const self = getCurrentInstance() as (ComponentInstance & { subTree?: any }) | null
  const rootRef = ref<HTMLElement | null>(null)
  const sync = () => {
    rootRef.value = self?.subTree?.el ?? null
  }
  onMounted(sync)
  onUpdated(sync)
  // 卸载置 null（对齐模板 ref 语义：卸载 → null）。
  // 让 watch(rootRef) 能观察完整生命周期：null→元素（挂载）/ 元素→元素（换根）/
  // 元素→null（卸载）——注册类副作用（composite listRef 等）可直接 watch 桥接
  onBeforeUnmount(() => {
    rootRef.value = null
  })
  return rootRef
}

export function setCurrentInstance(instance: ComponentInstance | null) {
  // 离开上一个实例：恢复其 scope 的上游
  if (currentInstance) currentInstance.scope?.off()
  currentInstance = instance
  // 进入新实例：激活其 scope
  instance?.scope?.on()
}

type HookType =
  | 'mounted'
  | 'updated'
  | 'beforeMount'
  | 'beforeUnmount'
  | 'unmounted'
  | 'activated'
  | 'deactivated'

export function onBeforeMount(fn: () => void) {
  registerHook('beforeMount', fn)
}

export function onMounted(fn: () => void) {
  registerHook('mounted', fn)
}

export function onUpdated(fn: () => void) {
  registerHook('updated', fn)
}

export function onBeforeUnmount(fn: () => void) {
  registerHook('beforeUnmount', fn)
}

/** 卸载完成后触发（beforeUnmount 之后、组件 effect 停止之后；Vue 3 语义） */
export function onUnmounted(fn: () => void) {
  registerHook('unmounted', fn)
}

/** KeepAlive 缓存组件被激活时触发（首次挂载后、每次从缓存恢复时） */
export function onActivated(fn: () => void) {
  registerHook('activated', fn)
}

/** KeepAlive 缓存组件被移入缓存（失活）时触发 */
export function onDeactivated(fn: () => void) {
  registerHook('deactivated', fn)
}

/** 捕获子组件渲染错误：返回 false 阻止向上传播（对齐 Vue 3 语义） */
export function onErrorCaptured(fn: (err: any) => boolean | void) {
  if (!currentInstance) {
    console.warn('[actview] onErrorCaptured 只能在组件 setup 中调用')
    return
  }
  currentInstance.errorCaptured.push(fn)
}

/** SSR 预取：renderToString 阶段执行（异步数据预取），客户端不执行 */
export function onServerPrefetch(fn: () => Promise<any> | any) {
  if (!currentInstance) {
    console.warn('[actview] onServerPrefetch 只能在组件 setup 中调用')
    return
  }
  currentInstance.serverPrefetch.push(fn)
}

/** 调试：render effect 依赖收集时触发 */
export function onRenderTracked(fn: (e: any) => void) {
  if (!currentInstance) {
    console.warn('[actview] onRenderTracked 只能在组件 setup 中调用')
    return
  }
  currentInstance.renderTracked.push(fn)
}

/** 调试：render effect 被依赖触发重跑时触发 */
export function onRenderTriggered(fn: (e: any) => void) {
  if (!currentInstance) {
    console.warn('[actview] onRenderTriggered 只能在组件 setup 中调用')
    return
  }
  currentInstance.renderTriggered.push(fn)
}

function registerHook(type: HookType, fn: () => void) {
  if (!currentInstance) {
    console.warn('[actview] 生命周期钩子只能在组件 setup 中调用')
    return
  }
  ;(currentInstance[type] as (() => void)[]).push(fn)
}

/**
 * 提供注入值（顶层 API，需在组件 setup 中调用——与生命周期钩子一致）。
 * 子组件经 ctx.injects 读取；同名 key 覆盖继承值、新 key 添加。
 * 性能：未调用 provide 的组件共享父注入表（零拷贝），首次调用时
 * copy-on-write 浅拷贝成自己的副本，之后 O(1) 写入。
 */
export function provide(key: PropertyKey, value: any) {
  const instance = getCurrentInstance()
  if (!instance) {
    console.warn('[actview] provide 只能在组件 setup 中调用')
    return
  }
  if (instance.injects === instance.parent?.injects) {
    instance.injects = { ...instance.injects }
  }
  instance.injects[key] = value
}

/**
 * 读取当前组件的注入表（provide/inject）。
 *   useInjects()          → 整个注入表
 *   useInjects('theme')   → 注入值（未提供返回 undefined）
 * 只能在组件 setup 中调用；响应式需求提供/注入 ref 值。
 */
export function useInjects(key?: PropertyKey): any {
  const instance = getCurrentInstance()
  if (!instance) {
    console.warn('[actview] useInjects 只能在组件 setup 中调用')
    return key ? undefined : {}
  }
  return key ? instance.injects[key] : instance.injects
}
