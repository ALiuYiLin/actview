// ============================================================
// 渲染器 — VNode 树 → 真实 DOM + 组件级更新（M1）
//
//   render(vnode, container)         应用 / 根 VNode 入口
//   patch(n1, n2, container, anchor) 树操作主流程（§7.1）
//     ├─ Text       文本节点（props.text ⇄ el.nodeValue）
//     ├─ Fragment   无宿主节点，children 批量 patch；el = 首个宿主节点
//     ├─ string     元素：mountElement / patchElement / unmountElement
//     └─ 组件       mountComponent / updateComponent / unmountComponent
//
// 更新粒度 = 组件（§1/§6）：
//   - 每个组件一个 ReactiveEffect（render effect），首帧同步执行；
//   - 响应式依赖变化 → effect.scheduler → queueJob(instance.job)，
//     微任务批处理（§8）；同 tick 多次变化只重跑一次 render；
//   - 组件卸载 = scope.stop()（停 render effect + setup 内 effect）+ job.active = false。
//
// children diff（§7.2 M2）：
//   - 无 key → unkeyed：公共段逐位 patch，旧多出的卸载，新多出的按锚点挂载；
//   - 有 key → keyed（Vue 3 风格）：头头 / 尾尾同步 → 中间段建 key→旧索引 map，
//     复用节点 patch、被删节点卸载、新节点按锚点插入、复用节点 insertBefore 移动；
//   - key 为 null 的子节点在 keyed 中间段按「旧无 key 节点出现顺序」复用；
//   - 锚点统一取「下一个已定位节点的宿主节点」：元素 / 文本用 el，Fragment /
//     组件沿子树收集宿主节点（可能为多个）；无宿主节点（渲染 null 的组件 /
//     空 Fragment）跳过移动或回退到调用方 anchor。
//
// 依赖边界（§9）：patch / DOM 操作不读取响应式数据；setup / 钩子由
// component.ts / lifecycle.ts 统一 pauseTracking；render 执行期间正常收集依赖。
// ============================================================

import { ReactiveEffect } from '@actview/reactivity'
import { isComponent } from '@actview/runtime-core'
import {
  Fragment,
  Text,
  createTextVNode,
  isVNode,
  type VNode,
} from '@actview/runtime-core/internal'
import {
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
  shouldUpdateComponent,
  updateProps,
} from './component'
import { createElement, patchProps } from './domProps'
import type { AppContext, ComponentInternalInstance } from './instance'
import { invokeHooks } from './lifecycle'
import { setRef } from './refs'
import { queueJob, queuePostFlushCb } from './scheduler'

// ------------------------------------------------------------
// 内部类型 / 常量
// ------------------------------------------------------------

/** DOM 容器 + 渲染器状态（当前挂载的根 VNode）；不是公开契约字段 */
type ContainerElement = Element & { _vnode?: VNode | null }

/**
 * 直接调用 render()（未经 createApp）时的兜底 AppContext。
 * 正常路径由 app.mount 把 AppContext 写到根 VNode 的 appContext 上。
 */
const fallbackAppContext: AppContext = { app: null, config: {}, provides: {} }

// ------------------------------------------------------------
// 对外入口
// ------------------------------------------------------------

/**
 * 渲染入口：把 vnode 挂载 / 更新到 container；`render(null, container)` 卸载。
 *
 * - 用 `container._vnode` 记录当前根 VNode（diff 的旧树），不污染 VNode 结构；
 * - 首帧同步完成（mount 返回时 DOM 已就绪），后续更新由 scheduler 批处理。
 */
export function render(vnode: VNode | null, container: Element): void {
  const host = container as ContainerElement
  const prevVNode = host._vnode ?? null

  if (vnode == null) {
    if (prevVNode) unmount(prevVNode, null)
    host._vnode = null
    return
  }

  patch(prevVNode, vnode, container, null, null)
  host._vnode = vnode
}

// ------------------------------------------------------------
// patch 分派（§7.1）
// ------------------------------------------------------------

function patch(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  if (n1 === n2) return

  // 类型 / key 不同 → 卸载旧的，走全新挂载
  if (n1 && !isSameVNodeType(n1, n2)) {
    unmount(n1, parent)
    n1 = null
  }

  const { type } = n2
  if (type === Text) {
    patchText(n1, n2, container, anchor)
  } else if (type === Fragment) {
    processFragment(n1, n2, container, anchor, parent)
  } else if (typeof type === 'string') {
    processElement(n1, n2, container, anchor, parent)
  } else if (isComponent(type)) {
    if (n1) updateComponent(n1, n2)
    else mountComponent(n2, container, anchor, parent)
  } else {
    throw new Error(`[actview] 无效的 VNode type：${String(type)}`)
  }
}

/** VNode 类型 / key 相同才能复用 DOM 做 patch */
function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

// ------------------------------------------------------------
// Text
// ------------------------------------------------------------

function patchText(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null,
): void {
  const text = String(n2.props?.text ?? '')

  if (n1) {
    // 更新：复用同一个文本节点，只改 nodeValue
    const el = n1.el as Node | null
    if (el) el.nodeValue = text
    n2.el = el
    return
  }

  const el = document.createTextNode(text)
  n2.el = el
  container.insertBefore(el, anchor)
}

// ------------------------------------------------------------
// 元素
// ------------------------------------------------------------

function processElement(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  if (n1 == null) {
    mountElement(n2, container, anchor, parent)
  } else {
    patchElement(n1, n2, parent)
  }
}

function mountElement(
  vnode: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  // SVG 命名空间由 domProps.createElement 统一处理
  const el = createElement(vnode.type as string)
  // 先写 el：子节点挂载 / ref 处理都可能回读 vnode.el
  vnode.el = el

  // children 归一化后挂到 el 内部，按顺序 append（anchor = null）
  const children = normalizeChildren(vnode.props?.children)
  vnode.children = children
  for (const child of children) patch(null, child, el, null, parent)

  // 属性 / class / style / 事件（children / key / ref 由各自路径处理）
  patchProps(el, null, vnode.props)

  const ref = resolveRef(vnode)
  if (ref != null) setRef(ref, el)

  container.insertBefore(el, anchor)
}

function patchElement(
  n1: VNode,
  n2: VNode,
  parent: ComponentInternalInstance | null,
): void {
  const el = n1.el as Element
  n2.el = el

  patchProps(el, n1.props, n2.props)
  patchChildren(n1, n2, el, null, parent)

  // ref 换绑：同一 ref 在挂载时已写入，只需处理变化
  const prevRef = resolveRef(n1)
  const nextRef = resolveRef(n2)
  if (prevRef !== nextRef) {
    setRef(prevRef, null)
    setRef(nextRef, el)
  }
}

function unmountElement(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
): void {
  for (const child of getChildren(vnode)) unmount(child, parent)

  const ref = resolveRef(vnode)
  if (ref != null) setRef(ref, null)

  const el = vnode.el as Element | null
  if (el) removeNode(el)
  vnode.el = null
}

// ------------------------------------------------------------
// Fragment
// ------------------------------------------------------------

function processFragment(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const children = normalizeChildren(n2.props?.children)
  n2.children = children

  if (n1 == null) {
    for (const child of children) patch(null, child, container, anchor, parent)
  } else {
    // 旧 Fragment 的 DOM 范围之后那个节点 = 新 children 的插入锚点；
    // 空 Fragment 无法从 DOM 反查，退回调用方传入的 anchor。
    patchChildren(n1, n2, container, getNextHostNode(n1) ?? anchor, parent)
  }

  n2.el = firstHostNode(children)
}

/** 第一个拥有宿主节点的子节点（空 / null 组件会被跳过） */
function firstHostNode(children: VNode[]): Node | null {
  for (const child of children) {
    const el = child.el as Node | null
    if (el) return el
  }
  return null
}

// ------------------------------------------------------------
// children diff（§7.2 M2）：unkeyed / keyed
// ------------------------------------------------------------

function patchChildren(
  n1: VNode,
  n2: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const prevChildren = getChildren(n1)
  const nextChildren = normalizeChildren(n2.props?.children)
  n2.children = nextChildren

  // 任一侧出现 key → 走 keyed diff（keyed 内部对 key 为 null 的节点做
  // 「按旧无 key 节点顺序复用」的回退）；否则 unkeyed 逐位 patch。
  const hasKey =
    prevChildren.some((child) => child.key != null) ||
    nextChildren.some((child) => child.key != null)

  if (hasKey) {
    patchKeyedChildren(prevChildren, nextChildren, container, anchor, parent)
  } else {
    patchUnkeyedChildren(prevChildren, nextChildren, container, anchor, parent)
  }
}

/**
 * unkeyed diff（Vue 3 patchUnkeyedChildren）：
 *   1) 公共长度逐位 patch（anchor = 该项之后第一个宿主节点，供嵌套 Fragment 用）；
 *   2) 旧多出的从尾部依次卸载；
 *   3) 新多出的按顺序插到 anchor 前（anchor = 旧 children 范围之后的位置）。
 */
function patchUnkeyedChildren(
  prevChildren: VNode[],
  nextChildren: VNode[],
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const commonLength = Math.min(prevChildren.length, nextChildren.length)

  for (let i = 0; i < commonLength; i++) {
    patch(
      prevChildren[i],
      nextChildren[i],
      container,
      nextHostNodeAfter(prevChildren, i, anchor),
      parent,
    )
  }

  // 旧多出：从尾部卸载（与 Vue 一致，避免索引漂移）
  for (let i = prevChildren.length - 1; i >= commonLength; i--) {
    unmount(prevChildren[i], parent)
  }

  // 新多出：顺序插到旧范围之后（同一 anchor 连续 insertBefore 保持顺序）
  for (let i = commonLength; i < nextChildren.length; i++) {
    patch(null, nextChildren[i], container, anchor, parent)
  }
}

/**
 * keyed diff（Vue 3 风格，M3 再叠加 LIS 最小移动）：
 *
 *   ① 头头同步：`isSameVNodeType`（type + key）相同就就地 patch；
 *   ② 尾尾同步：同上，从两侧向中间收拢；
 *   ③ 旧序列先耗尽 → 剩余新节点依次插到「新后缀首个宿主节点」前；
 *   ④ 新序列先耗尽 → 剩余旧节点全部卸载；
 *   ⑤ 中间段：旧 key→索引 map；新节点按 key 命中则 patch 复用（无 key 的按
 *      旧无 key 节点出现顺序复用），未命中标记为待挂载；
 *   ⑥ 卸载所有未被复用的旧节点；
 *   ⑦ 从后往前：未命中的节点按锚点挂载，命中的节点 insertBefore 移动到锚点前；
 *      anchor 恒为「下一个新节点的首个宿主节点」（尾部回退到调用方 anchor）。
 */
function patchKeyedChildren(
  prevChildren: VNode[],
  nextChildren: VNode[],
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const prevLength = prevChildren.length
  const nextLength = nextChildren.length
  let start = 0
  let prevEnd = prevLength - 1
  let nextEnd = nextLength - 1

  // ① 头头同步
  while (
    start <= prevEnd &&
    start <= nextEnd &&
    isSameVNodeType(prevChildren[start], nextChildren[start])
  ) {
    patch(
      prevChildren[start],
      nextChildren[start],
      container,
      nextHostNodeAfter(prevChildren, start, anchor),
      parent,
    )
    start++
  }

  // ② 尾尾同步
  while (
    start <= prevEnd &&
    start <= nextEnd &&
    isSameVNodeType(prevChildren[prevEnd], nextChildren[nextEnd])
  ) {
    patch(
      prevChildren[prevEnd],
      nextChildren[nextEnd],
      container,
      nextHostNodeAfter(prevChildren, prevEnd, anchor),
      parent,
    )
    prevEnd--
    nextEnd--
  }

  // ③ 旧节点已全部对位 → 剩余新节点都是新增
  if (start > prevEnd) {
    if (start <= nextEnd) {
      const nextAnchor = anchorFromIndex(nextChildren, nextEnd + 1, anchor)
      for (let i = start; i <= nextEnd; i++) {
        patch(null, nextChildren[i], container, nextAnchor, parent)
      }
    }
    return
  }

  // ④ 新节点已全部对位 → 剩余旧节点都是删除
  if (start > nextEnd) {
    for (let i = start; i <= prevEnd; i++) unmount(prevChildren[i], parent)
    return
  }

  // ⑤ 中间段：建 key → 旧索引 map；旧无 key 节点按出现顺序排队
  const oldKeyToIndex = new Map<unknown, number>()
  const oldUnkeyedIndexes: number[] = []
  for (let i = start; i <= prevEnd; i++) {
    const { key } = prevChildren[i]
    if (key != null) oldKeyToIndex.set(key, i)
    else oldUnkeyedIndexes.push(i)
  }

  /** 已被复用的旧索引 */
  const reusedOldIndexes = new Set<number>()
  /** 已 patch（复用）的新索引；未在集合中的新节点需要挂载 */
  const reusedNewIndexes = new Set<number>()
  let unkeyedCursor = 0

  for (let i = start; i <= nextEnd; i++) {
    const nextChild = nextChildren[i]
    let oldIndex = -1

    if (nextChild.key != null) {
      const found = oldKeyToIndex.get(nextChild.key)
      if (found !== undefined && !reusedOldIndexes.has(found)) oldIndex = found
    } else if (unkeyedCursor < oldUnkeyedIndexes.length) {
      oldIndex = oldUnkeyedIndexes[unkeyedCursor++]
    }

    if (oldIndex < 0) continue // 新增节点，第 ⑦ 步统一挂载

    reusedOldIndexes.add(oldIndex)
    reusedNewIndexes.add(i)
    // 复用：先 patch（type 不同时 patch 内部会卸载旧的再挂新的；新 DOM 暂可
    // 落在 anchor 位置，第 ⑦ 步统一移动到正确位置）
    patch(prevChildren[oldIndex], nextChild, container, anchor, parent)
  }

  // ⑥ 卸载未被复用的旧节点
  for (let i = start; i <= prevEnd; i++) {
    if (!reusedOldIndexes.has(i)) unmount(prevChildren[i], parent)
  }

  // ⑦ 从后往前定位：anchor = 下一个已定位节点的首个宿主节点
  let nextAnchor = anchorFromIndex(nextChildren, nextEnd + 1, anchor)
  for (let i = nextEnd; i >= start; i--) {
    const nextChild = nextChildren[i]

    if (!reusedNewIndexes.has(i)) {
      // 新节点：直接挂载到 anchor 前（Fragment / 组件内部按锚点顺序插入）
      patch(null, nextChild, container, nextAnchor, parent)
    } else {
      // 复用节点：移动到 anchor 前（已就位时 moveHostNodes 内部跳过）
      moveHostNodes(nextChild, container, nextAnchor)
    }

    const firstHost = firstHostNodeDeep(nextChild)
    if (firstHost) nextAnchor = firstHost
  }
}

// ------------------------------------------------------------
// 组件
// ------------------------------------------------------------

function mountComponent(
  vnode: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  // ① 创建实例（vnode.component / instance.vnode 互相指向）
  const instance = createComponentInstance(
    vnode,
    parent,
    resolveAppContext(vnode, parent),
  )
  vnode.component = instance
  instance.vnode = vnode
  // 更新时的容器（instance.ts 的 container 字段标注为契约层 Element，
  // 渲染器实际写入 DOM 宿主元素）
  instance.container = container as unknown as ComponentInternalInstance['container']

  // ② setup 只执行一次（内部 pauseTracking + currentInstance 栈）
  setupComponent(instance)

  // ③ render effect + 首帧同步渲染
  setupRenderEffect(instance, container, anchor)

  // 组件 ref → 公开实例 proxy（元素 ref → DOM，在 mountElement 中处理）
  const ref = resolveRef(vnode)
  if (ref != null) setRef(ref, instance.proxy)
}

/**
 * 组件 render effect：首帧同步挂载，后续由 scheduler 触发更新（§6.2）。
 */
function setupRenderEffect(
  instance: ComponentInternalInstance,
  container: Element,
  anchor: Node | null,
): void {
  const componentUpdateFn = (): void => {
    // ---- 首帧：同步挂载子树 ----
    if (!instance.isMounted) {
      invokeHooks(instance.beforeMount, instance)

      const subTree = renderComponentRoot(instance)
      instance.subTree = subTree
      if (subTree) patch(null, subTree, container, anchor, instance)
      instance.vnode.el = subTree ? subTree.el : null

      instance.isMounted = true
      // mounted 是 post hook：等整轮 patch 完成、DOM 就绪后执行
      // （子组件挂载先入队 → 子 mounted 先于父 mounted）
      queuePostFlushCb(() => invokeHooks(instance.mounted, instance))
      return
    }

    // ---- 更新：diff 旧子树 → 新子树 ----
    invokeHooks(instance.beforeUpdate, instance)

    const prevTree = instance.subTree
    const nextTree = renderComponentRoot(instance)
    instance.subTree = nextTree
    const hostContainer = instanceContainer(instance)

    if (prevTree && nextTree) {
      patch(prevTree, nextTree, hostContainer, getNextHostNode(prevTree), instance)
      instance.vnode.el = nextTree.el
    } else if (nextTree) {
      // 上一帧 render 返回 null，本帧有内容：无旧树可 diff，直接挂载
      patch(null, nextTree, hostContainer, null, instance)
      instance.vnode.el = nextTree.el
    } else {
      // 本帧 render 返回 null：移除旧树
      if (prevTree) unmount(prevTree, instance)
      instance.vnode.el = null
    }

    queuePostFlushCb(() => invokeHooks(instance.updated, instance))
  }

  // job 先建：首帧挂载子组件时 effect.scheduler 已可能在 flush 中排队
  instance.job = {
    id: instance.uid,
    active: true,
    run: () => instance.effect.run(),
  }
  instance.update = () => queueJob(instance.job)

  // ReactiveEffect 构造时绑定当前的 activeEffectScope（本版本 reactivity 的
  // 构造签名只有 fn），因此必须在 instance.scope.run 内创建 —— 否则组件卸载
  // 时 scope.stop() 停不掉 render effect。
  instance.scope.run(() => {
    const effect = new ReactiveEffect(componentUpdateFn)
    effect.scheduler = () => queueJob(instance.job)
    instance.effect = effect
    // 首帧同步执行（mount 返回时 DOM 已就绪）
    effect.run()
  })
}

/**
 * 父组件 patch 到同类型子组件：复用实例、原地更新 props、按需入队更新。
 * 实例复用 → setup 不重跑，只有 render 重跑（§6.4）。
 */
function updateComponent(n1: VNode, n2: VNode): void {
  const instance = (n2.component = n1.component) as unknown as ComponentInternalInstance

  instance.vnode = n2
  n2.el = n1.el

  // 原地写 shallowReactive props：值变化会触发子 render effect 的 scheduler
  updateProps(instance, n2.props, n1.props)

  // ref 换绑（组件 ref → 公开实例 proxy）
  const prevRef = resolveRef(n1)
  const nextRef = resolveRef(n2)
  if (prevRef !== nextRef) {
    setRef(prevRef, null)
    setRef(nextRef, instance.proxy)
  }

  // 显式入队与 props 触发由 job 去重合并（同 tick 只跑一次）
  if (shouldUpdateComponent(n1, n2)) queueJob(instance.job)
}

/**
 * 卸载组件：beforeUnmount → scope.stop() → job 失效 → 卸载子树 →
 * unmounted（post）→ 组件 ref 置 null（§6.2）。
 */
function unmountComponent(vnode: VNode): void {
  const instance = vnode.component as unknown as ComponentInternalInstance | null
  if (!instance) return

  invokeHooks(instance.beforeUnmount, instance)

  // 停 render effect + setup 期间创建的 watch / computed
  instance.scope.stop()
  // flush 中可能仍排着该组件的更新任务 → 跳过
  instance.job.active = false

  const subTree = instance.subTree
  if (subTree) {
    unmount(subTree, instance)
    instance.subTree = null
  }

  queuePostFlushCb(() => invokeHooks(instance.unmounted, instance))

  setRef(resolveRef(instance.vnode), null)
  instance.isMounted = false
  vnode.el = null
}

// ------------------------------------------------------------
// unmount 分派
// ------------------------------------------------------------

function unmount(vnode: VNode, parent: ComponentInternalInstance | null): void {
  const { type } = vnode

  if (type === Text) {
    const el = vnode.el as Node | null
    if (el) removeNode(el)
    vnode.el = null
    return
  }

  if (type === Fragment) {
    for (const child of getChildren(vnode)) unmount(child, parent)
    vnode.el = null
    return
  }

  if (typeof type === 'string') {
    unmountElement(vnode, parent)
    return
  }

  if (isComponent(type)) {
    unmountComponent(vnode)
  }
}

// ------------------------------------------------------------
// 锚点 / 子节点工具
// ------------------------------------------------------------

/**
 * VNode 的宿主 DOM 范围之后的那个节点（插入锚点 / 更新定位用）。
 * - Fragment：最后一个宿主节点的下一节点（空 Fragment → null）；
 * - 组件：沿 subTree 递归（组件根可能是 Fragment / 渲染 null）；
 * - 元素 / 文本：el.nextSibling。
 */
function getNextHostNode(vnode: VNode): Node | null {
  const last = lastHostNode(vnode)
  return last ? last.nextSibling : null
}

/**
 * 收集 vnode 子树的全部宿主 DOM 节点（文档顺序）：
 * - 元素 / 文本 → [vnode.el]；
 * - Fragment → 递归 children（可能有多个宿主节点）；
 * - 组件 → 递归 instance.subTree（组件根可能是 Fragment，vnode.el 只是首节点）。
 */
function collectHostNodes(vnode: VNode, out: Node[] = []): Node[] {
  const { type } = vnode

  if (type === Fragment) {
    for (const child of getChildren(vnode)) collectHostNodes(child, out)
    return out
  }

  if (isComponent(type)) {
    const instance = vnode.component as unknown as ComponentInternalInstance | null
    if (instance && instance.subTree) {
      collectHostNodes(instance.subTree, out)
      return out
    }
    const el = vnode.el as Node | null
    if (el) out.push(el)
    return out
  }

  const el = vnode.el as Node | null
  if (el) out.push(el)
  return out
}

/** 子树第一个宿主节点（渲染 null 的组件 / 空 Fragment → null） */
function firstHostNodeDeep(vnode: VNode): Node | null {
  const nodes = collectHostNodes(vnode)
  return nodes.length > 0 ? nodes[0] : null
}

/** 子树最后一个宿主节点（无宿主节点 → null） */
function lastHostNode(vnode: VNode): Node | null {
  const nodes = collectHostNodes(vnode)
  return nodes.length > 0 ? nodes[nodes.length - 1] : null
}

/**
 * 把 vnode 子树的所有宿主节点移动到 container 的 anchor 之前（保持顺序）。
 * - 无宿主节点 → 无操作（渲染 null 的组件 / 空 Fragment）；
 * - 已紧邻 anchor 之前 → 跳过（避免无谓 DOM 操作）。
 */
function moveHostNodes(
  vnode: VNode,
  container: Element,
  anchor: Node | null,
): void {
  const nodes = collectHostNodes(vnode)
  if (nodes.length === 0) return

  const last = nodes[nodes.length - 1]
  if (last.parentNode === container && last.nextSibling === anchor) return

  // 连续 insertBefore(el, anchor) 保持节点相对顺序（A B anchor 顺序成立）
  for (const node of nodes) container.insertBefore(node, anchor)
}

/**
 * 列表中第 index 项 DOM 范围之后的第一个节点。
 * 优先用 getNextHostNode 反查；该项无宿主节点（渲染 null 组件 / 空 Fragment）
 * 时向后扫描兄弟，最后回退到调用方 anchor。
 */
function nextHostNodeAfter(
  children: VNode[],
  index: number,
  fallback: Node | null,
): Node | null {
  const next = getNextHostNode(children[index])
  if (next) return next

  for (let i = index + 1; i < children.length; i++) {
    const first = firstHostNodeDeep(children[i])
    if (first) return first
  }
  return fallback
}

/** 从 children[from] 起第一个宿主节点；都没有时回退 fallback */
function anchorFromIndex(
  children: VNode[],
  from: number,
  fallback: Node | null,
): Node | null {
  for (let i = from; i < children.length; i++) {
    const first = firstHostNodeDeep(children[i])
    if (first) return first
  }
  return fallback
}

/** 已挂载 VNode 的子节点列表；未挂载过时从 props.children 归一化 */
function getChildren(vnode: VNode): VNode[] {
  if (Array.isArray(vnode.children)) return vnode.children as VNode[]
  return normalizeChildren(vnode.props?.children)
}

/**
 * children 归一化（§6.3 / §7.2）：
 *   - null / undefined / boolean → 跳过（不产生节点）
 *   - 嵌套数组 → 递归展平
 *   - string / number → 文本 VNode
 *   - VNode → 原样
 *   - 其它（函数 / 普通对象）→ 报错
 */
function normalizeChildren(children: unknown): VNode[] {
  if (children == null || typeof children === 'boolean') return []

  // 递归展平（不用 Array.prototype.flat：core 的 lib 对齐上游 reactivity 的
  // ES2016，避免依赖更新的 array lib 方法）
  const flat: unknown[] = []
  flattenInto(children, flat)

  const result: VNode[] = []
  for (const child of flat) {
    if (child == null || typeof child === 'boolean') continue
    if (typeof child === 'string' || typeof child === 'number') {
      result.push(createTextVNode(String(child)))
      continue
    }
    if (isVNode(child)) {
      result.push(child)
      continue
    }
    throw new Error(
      `[actview] 无效的子节点：期望 VNode / string / number / null，当前为 ${typeof child}`,
    )
  }
  return result
}

/** 递归把嵌套数组里的值压入 out（保留其余类型交给 normalizeChildren 分类） */
function flattenInto(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenInto(item, out)
    return
  }
  out.push(value)
}

/**
 * ref 来源：jsx runtime 只提升 key，ref 留在 props 里（vnode.ref 恒为 null）。
 * props.ref 优先，vnode.ref 兜底以兼容手工构造的 VNode。
 */
function resolveRef(vnode: VNode): unknown {
  return vnode.props?.ref ?? vnode.ref
}

/** 根 VNode 的 AppContext（app.mount 写入）；子组件继承父实例的 appContext */
function resolveAppContext(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
): AppContext {
  if (parent) return parent.appContext
  const appContext = (vnode as unknown as { appContext?: AppContext }).appContext
  return appContext ?? fallbackAppContext
}

/** 实例上记录（挂载时传入）的 DOM 容器 */
function instanceContainer(instance: ComponentInternalInstance): Element {
  return instance.container as unknown as Element
}

/** 从父节点移除（Element / Text 都按 Node 处理） */
function removeNode(node: Node): void {
  const parent = node.parentNode as Node | null
  if (parent) parent.removeChild(node)
}
