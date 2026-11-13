// ============================================================
// KeepAlive — 缓存组件实例与 DOM，切换时不销毁不重建（M3，类组件迁移）
//
//   机制（与 renderer 的 __keepAlive 分支协作）：
//   1) render 给子组件 vnode 打 `__keepAlive = { cache, storage, key, max }`
//      标记；命中缓存时返回缓存的 vnode 并原地更新其 props（renderer 的
//      激活路径负责把 DOM 从 storage 移回容器 + instance.update()）。
//   2) renderer 的 unmount 检测到标记 → DOM 移入隐藏 storage、实例保留
//      （不 stop effect）、触发 deactivated，并把 vnode 写入 cache。
//   3) KeepAlive 自身卸载时：活动子节点走正常卸载；失活缓存逐个真正销毁。
//   4) max：每次 render 前对 cache 做 LRU 淘汰（超出上限的最旧项真正销毁）。
//
//   宿主节点：组件子树可能是 Fragment 多根，缓存 DOM 的移动 / 删除统一用
//   ./hostNodes 的 collectHostNodes 处理全部宿主节点。
// ============================================================

import { isComponent } from '../internal'
import type { VNode } from '../internal'
import { isVNode } from '../internal'
import { updateProps } from '../runtime/component'
import { ActViewComponent, BeforeUnmount, Component, Setup } from '../decorator'
import { collectHostNodes } from '../runtime/hostNodes'
import type { ComponentInternalInstance } from '../runtime/instance'
import { getCurrentInstance, invokeHooks } from '../lifecycle'

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

/** 组件名（类组件 name / @Component({ name })；KeepAlive include/exclude 用） */
function getComponentName(child: VNode): string {
  const type = child.type as { name?: unknown }
  return typeof type === 'function' && typeof type.name === 'string'
    ? type.name
    : ''
}

/** VNode 类型 / key 相同（与 renderer 的 isSameVNodeType 判据一致） */
function isSameVNodeType(a: VNode, b: VNode): boolean {
  return a.type === b.type && a.key === b.key
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

@Component({ name: 'KeepAlive' })
export class KeepAlive extends ActViewComponent<KeepAliveProps> {
  /** 失活实例缓存：key → 组件 vnode（LRU：命中/新增移到末尾） */
  private cache = new Map<unknown, VNode>()
  /** 失活组件的 DOM 隐藏容器（脱离文档，不产生可见 DOM） */
  private storage = document.createElement('div')
  /** 当前 KeepAlive 实例（@Setup 时写入；renderer 激活路径用 container） */
  private self: ComponentInternalInstance | null = null
  /** 最近一次 render 返回的 vnode 与 key（卸载时区分活动项/缓存项） */
  private lastChild: VNode | null = null
  private lastKey: unknown = undefined

  @Setup
  setup(): void {
    this.storage.style.display = 'none'
    this.storage.setAttribute('aria-hidden', 'true')

    const self = getCurrentInstance()
    this.self = self
    if (self) {
      ;(
        self as unknown as { __keepAliveCache?: Map<unknown, VNode> }
      ).__keepAliveCache = this.cache
    }
  }

  private createMeta(key: unknown): KeepAliveMeta {
    return {
      cache: this.cache,
      storage: this.storage,
      key,
      max: this.$props.max,
    }
  }

  /**
   * 真正销毁一个缓存实例（不经过 renderer 的 unmount 路径，避免 import
   * renderer 造成循环依赖）：停 scope/更新任务 → 移除全部宿主 DOM → 卸载钩子。
   */
  private destroyCached(cached: VNode): void {
    delete (cached as any).__keepAlive
    const instance = cached.component as ComponentInternalInstance | null
    if (!instance) return

    instance.scope?.stop()
    if (instance.job) instance.job.active = false

    // 失活组件的全部宿主节点（多根 → 多个，通常已在 storage 中）
    for (const node of collectHostNodes(instance.subTree ?? cached)) {
      if (node.parentNode) node.parentNode.removeChild(node)
    }

    instance.isMounted = false
    instance.container = null
    invokeHooks(instance.unmounted, instance)
  }

  /**
   * max LRU：缓存超过上限时淘汰最旧项（Map 插入序）。
   *
   * 注意：命中缓存时活动 vnode 仍留在 cache 里（Vue 同语义），因此它也可能
   * 成为「最旧项」被淘汰 —— 若淘汰的正是当前活动项，**不能销毁**（它还在
   * 页面上）：只摘掉缓存标记，之后它卸载时由 renderer 走正常 unmount 路径。
   */
  private pruneCache(): void {
    const max = this.$props.max
    if (typeof max !== 'number' || !Number.isFinite(max)) return
    while (this.cache.size > max) {
      const oldestKey = this.cache.keys().next().value as unknown
      const oldest = this.cache.get(oldestKey)
      this.cache.delete(oldestKey)
      if (!oldest) continue

      if (this.lastChild && isSameVNodeType(oldest, this.lastChild)) {
        // 活动项被淘汰：不销毁，仅移除缓存标记（接下来切走时正常卸载）
        delete (oldest as any).__keepAlive
        continue
      }
      this.destroyCached(oldest)
    }
  }

  @BeforeUnmount
  cleanup(): void {
    // 活动子节点：去掉缓存标记，让 renderer 走正常 unmount 路径
    if (this.lastChild && (this.lastChild as any).__keepAlive) {
      delete (this.lastChild as any).__keepAlive
    }
    // 激活路径若未把活动项移出 cache，先剔除，避免重复销毁
    if (this.lastKey !== undefined) this.cache.delete(this.lastKey)
    for (const cached of this.cache.values()) this.destroyCached(cached)
    this.cache.clear()
    while (this.storage.firstChild) {
      this.storage.removeChild(this.storage.firstChild)
    }
  }

  render() {
    const props = this.$props

    // 先做 LRU 淘汰（renderer 在上一轮 unmount 时写入 cache 后才可能超限）
    this.pruneCache()

    const child = normalizeChild(props.children)
    this.lastChild = isVNode(child) ? child : null
    this.lastKey = undefined

    // 非组件子节点：不参与缓存，原样交给 renderer
    if (!isVNode(child)) return child
    const type = child.type as unknown
    if (!isComponent(type)) return child

    const name = getComponentName(child)
    // include / exclude 名字过滤：未命中缓存策略 → 不缓存（正常挂载/卸载）
    if (props.include != null && !matches(props.include, name)) return child
    if (props.exclude != null && matches(props.exclude, name)) return child

    const key = child.key != null ? child.key : (type as unknown)
    this.lastKey = key

    const cached = this.cache.get(key)
    if (cached && cached.component) {
      // 命中：LRU 移到末尾
      this.cache.delete(key)
      this.cache.set(key, cached)

      const instance = cached.component as unknown as ComponentInternalInstance
      // 原地更新实例 props（shallowReactive；renderer 激活路径会再 update()）
      updateProps(instance, child.props, cached.props)
      // 原地更新缓存 vnode 的 props / ref，供 renderer 激活路径使用
      ;(cached as any).props = child.props
      ;(cached as any).ref = (child as any).ref
      // 重新打标记：本次激活结束后，下次卸载仍需走缓存分支
      ;(cached as any).__keepAlive = this.createMeta(key)
      this.lastChild = cached
      return cached
    }

    // 未命中：打标记，renderer 卸载时据此把实例/DOM 移入缓存
    ;(child as any).__keepAlive = this.createMeta(key)
    return child
  }
}
