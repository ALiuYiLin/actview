// ============================================================
// KeepAlive — 缓存组件实例与 DOM，切换时不销毁不重建（M3 最小集）
//
//   机制（与 renderer 的 __keepAlive 分支协作）：
//   1) render 给子组件 vnode 打 `__keepAlive = { cache, storage, key, max }`
//      标记；命中缓存时返回缓存的 vnode 并原地更新其 props（renderer 的
//      激活路径负责把 DOM 从 storage 移回容器 + instance.update()）。
//   2) renderer 的 unmount 检测到标记 → DOM 移入隐藏 storage、实例保留
//      （不 stop effect）、触发 deactivated，并把 vnode 写入 cache。
//   3) KeepAlive 自身卸载时：活动子节点走正常卸载；失活缓存逐个真正销毁
//      （scope.stop + 移除 DOM + isMounted=false + unmounted hooks）。
//   4) max：每次 render 前对 cache 做 LRU 淘汰（超出上限的最旧项真正销毁）。
//
//   限制：只支持单个组件子节点（组件 subTree 单根 DOM；Fragment 多根不支持）。
// ============================================================

import { defineComponent, isComponent } from '@actview/runtime-core'
import type { VNode } from '@actview/runtime-core/internal'
import { isVNode } from '@actview/runtime-core/internal'
import { updateProps } from './component'
import type { ComponentInternalInstance } from './instance'
import { getCurrentInstance, invokeHooks, onBeforeUnmount } from './lifecycle'

/** include / exclude 匹配模式（数组可混合字符串与正则） */
export type KeepAliveMatchPattern =
  | string
  | RegExp
  | Array<string | RegExp>

export interface KeepAliveProps {
  children?: any
  include?: KeepAliveMatchPattern
  exclude?: KeepAliveMatchPattern
  /** 最大缓存数（LRU 淘汰最旧） */
  max?: number
}

/** 子 vnode 上的缓存标记（renderer 读取同一结构） */
interface KeepAliveMeta {
  cache: Map<unknown, VNode>
  storage: HTMLElement
  key: unknown
  max?: number
}

/** include / exclude 匹配：数组逐项 / 正则 test / 逗号分隔字符串 */
function matches(pattern: KeepAliveMatchPattern | undefined, name: string): boolean {
  if (pattern == null) return false
  if (Array.isArray(pattern)) return pattern.some((p) => matches(p, name))
  if (pattern instanceof RegExp) return pattern.test(name)
  if (typeof pattern === 'string') {
    return pattern
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .includes(name)
  }
  return false
}

/** 组件名（defineComponent 写入的 name；KeepAlive include/exclude 用） */
function getComponentName(child: VNode): string {
  const type = child.type as { name?: unknown }
  return typeof type === 'function' && typeof type.name === 'string'
    ? type.name
    : ''
}

/** props.children 归一化为单个子节点（数组展平后取第一个非空项） */
function normalizeChild(children: unknown): any {
  if (children == null || typeof children === 'boolean') return null
  const list = Array.isArray(children)
    ? (children as unknown[]).flat(Infinity)
    : [children]
  for (const item of list) {
    if (item != null && typeof item !== 'boolean') return item
  }
  return null
}

export const KeepAlive = defineComponent<KeepAliveProps>((props) => {
  /** 失活实例缓存：key → 组件 vnode（LRU：命中/新增移到末尾） */
  const cache = new Map<unknown, VNode>()
  /** 失活组件的 DOM 隐藏容器（脱离文档，不产生可见 DOM） */
  const storage = document.createElement('div')
  storage.style.display = 'none'
  storage.setAttribute('aria-hidden', 'true')

  // 当前 KeepAlive 实例：DOM 归还容器由 renderer 激活路径负责（instance.container）；
  // 这里把 cache 挂到实例上，便于 DevTools / 调试观察缓存内容。
  const self = getCurrentInstance()
  if (self) {
    ;(self as unknown as { __keepAliveCache?: Map<unknown, VNode> }).__keepAliveCache =
      cache
  }

  /** 最近一次 render 返回的 vnode 与 key（卸载时区分活动项/缓存项） */
  let lastChild: VNode | null = null
  let lastKey: unknown = undefined

  const createMeta = (key: unknown): KeepAliveMeta => ({
    cache,
    storage,
    key,
    max: props.max,
  })

  /**
   * 真正销毁一个缓存实例（不经过 renderer 的 unmount 路径，避免 import
   * renderer 造成循环依赖）：停 scope/更新任务 → 移除 DOM → 卸载钩子。
   */
  const destroyCached = (cached: VNode): void => {
    delete (cached as any).__keepAlive
    const instance = cached.component as ComponentInternalInstance | null
    if (!instance) return

    instance.scope?.stop()
    if (instance.job) instance.job.active = false

    // 子组件只支持单根：subTree.el 即宿主节点（可能已在 storage 中）
    const el = (((instance.subTree as any)?.el ?? (cached as any).el) as Node | null)
    if (el?.parentNode) el.parentNode.removeChild(el)

    instance.isMounted = false
    instance.container = null
    invokeHooks(instance.unmounted, instance)
  }

  /** max LRU：缓存超过上限时淘汰最旧项（Map 插入序） */
  const pruneCache = (): void => {
    const max = props.max
    if (typeof max !== 'number' || !Number.isFinite(max)) return
    while (cache.size > max) {
      const oldestKey = cache.keys().next().value as unknown
      const oldest = cache.get(oldestKey)
      cache.delete(oldestKey)
      if (oldest) destroyCached(oldest)
    }
  }

  onBeforeUnmount(() => {
    // 活动子节点：去掉缓存标记，让 renderer 走正常 unmount 路径
    // （否则 renderer 的 __keepAlive 分支会把它移入 storage 而不停止 effect）
    if (lastChild && (lastChild as any).__keepAlive) {
      delete (lastChild as any).__keepAlive
    }
    // 激活路径若未把活动项移出 cache，先剔除，避免重复销毁
    if (lastKey !== undefined) cache.delete(lastKey)
    for (const cached of cache.values()) destroyCached(cached)
    cache.clear()
    while (storage.firstChild) storage.removeChild(storage.firstChild)
  })

  return () => {
    // 先做 LRU 淘汰（renderer 在上一轮 unmount 时写入 cache 后才可能超限）
    pruneCache()

    const child = normalizeChild(props.children)
    lastChild = isVNode(child) ? child : null
    lastKey = undefined

    // 非组件子节点：不参与缓存，原样交给 renderer
    if (!isVNode(child)) return child
    const type = child.type as unknown
    if (!isComponent(type)) return child

    const name = getComponentName(child)
    // include / exclude 名字过滤：未命中缓存策略 → 不缓存（正常挂载/卸载）
    if (props.include != null && !matches(props.include, name)) return child
    if (props.exclude != null && matches(props.exclude, name)) return child

    const key = child.key != null ? child.key : (type as unknown)
    lastKey = key

    const cached = cache.get(key)
    if (cached && cached.component) {
      // 命中：LRU 移到末尾
      cache.delete(key)
      cache.set(key, cached)

      // vnode.component 的类型来自 runtime-core 的最小内部实例契约；
      // 渲染器侧实际是 core 的 ComponentInternalInstance。
      const instance = cached.component as unknown as ComponentInternalInstance
      // 原地更新实例 props（shallowReactive；renderer 激活路径会再 update()）
      updateProps(instance, child.props, cached.props)
      // 原地更新缓存 vnode 的 props / ref，供 renderer 激活路径使用
      ;(cached as any).props = child.props
      ;(cached as any).ref = (child as any).ref
      // 重新打标记：本次激活结束后，下次卸载仍需走缓存分支
      ;(cached as any).__keepAlive = createMeta(key)
      lastChild = cached
      return cached
    }

    // 未命中：打标记，renderer 卸载时据此把实例/DOM 移入缓存
    ;(child as any).__keepAlive = createMeta(key)
    return child
  }
}, 'KeepAlive')
