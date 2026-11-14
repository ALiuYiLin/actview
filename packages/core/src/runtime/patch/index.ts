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
// M3（§10 / §11）：
//   - keyed 中间段移动用 LIS 最小化：只有不在最长递增子序列上的复用节点才移动；
//   - async setup：setupComponent 返回 Promise 时先挂 null 占位，resolve 后写入
//     render 并 queueJob；同时向当前 Suspense 注册 / 解决（register / resolve）；
//   - 错误路径：setup / render+patch / unmount 统一 try/catch → handleError
//     （errorCaptured 沿 parent 链 → app.config.errorHandler）；已被捕获则继续
//     挂载占位 / 保持旧 DOM，未捕获继续向上抛；
//   - DevTools：mount / update / unmount 上报 getDevtoolsHook()（hook 为空零开销）。
//
// M3b 内置组件（Teleport / Transition / KeepAlive）：
//   - Teleport：`type.__builtin === 'teleport'`，父容器插入占位注释
//     （vnode.el）维持本树位置，children patch 到目标容器的 targetAnchor
//     （vnode.__teleportTargetAnchor）之前；内容不在本容器，跨树顺序由
//     两个注释锚点保证（多 Teleport 同 target / to 切换迁移 / 卸载清理）；
//   - Transition：`type.__builtin === 'transition'`，单子节点 + enter/leave 类名，
//     离场完成后才真正卸载旧子节点；
//   - KeepAlive：keepAlive.ts 给可缓存子 vnode 打 `__keepAlive` 标记；renderer
//     在 unmount 时把**全部**宿主节点（Fragment 多根）移入 storage + deactivated
//     （不 stop 不卸载），重新挂载带 component 的缓存 vnode 时全部移回 DOM +
//     update + activated。宿主节点收集统一走 ./hostNodes（与 keepAlive 共用）。
//
// 依赖边界（§9）：patch / DOM 操作不读取响应式数据；setup / 钩子由
// component.ts / lifecycle.ts 统一 pauseTracking；render 执行期间正常收集依赖。
// ============================================================

import { EffectFlags, ReactiveEffect } from '@actview/reactivity'
import { isComponent, type RenderFunction } from '../../internal'
import {
  Fragment,
  Text,
  createTextVNode,
  createVNode,
  isVNode,
  type VNode,
} from '../../internal'
import {
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
  shouldUpdateComponent,
  updateProps,
} from '../component'
import { getDevtoolsHook, notifyDevtoolsComponent, notifyDevtoolsPerformance, notifyDevtoolsReactive } from '../devtools'
import { createElement, patchProps } from './patchProps'
import { handleError } from '../errorHandling'
import { collectHostNodes, firstHostNode, lastHostNode } from '../hostNodes'
import type { AppContext, ComponentInternalInstance } from '../instance'
import { invokeHooks } from '../../lifecycle'
import { setRef } from '../refs'
import { queueJob, queuePostFlushCb } from '../scheduler'
import { getCurrentSuspense } from '../../components/Suspense'
import { resolveTeleportTarget } from '../../components/Teleport'
import { applyTransitionEnter, applyTransitionLeave } from '../../components/Transition'

// ------------------------------------------------------------
// 内部类型 / 常量
// ------------------------------------------------------------

/** DOM 容器 + 渲染器状态（当前挂载的根 VNode）；不是公开契约字段 */
type ContainerElement = Element & { _vnode?: VNode | null }

/**
 * 直接调用 render()（未经 createApp）时的兜底 AppContext。
 * 正常路径由 app.mount 把 AppContext 写到根 VNode 的 appContext 上。
 */
const fallbackAppContext: AppContext = {
  app: null,
  appId: 0,
  config: {},
  provides: {},
  root: null,
}

// ------------------------------------------------------------
// Hydration
// ------------------------------------------------------------
let hydrating = false
let hydrationCursor: Node | null = null
/** Teleport 迁移延后到整棵树 hydrate 完成后，避免目标容器内的后续 cleanup 误删内容。 */
const pendingTeleportMoves: Array<{
  start: Node
  stop: Node | null
  target: Element
  targetAnchor: Node
  endMarker: Node | null
}> = []

function hydrationMismatch(expected: string, actual: Node | null): void {
  if (!__DEV__) return
  console.warn(
    `[actview] hydration mismatch：期望 ${expected}，实际 ${actual?.nodeName ?? 'null'}`,
  )
}

/** 跳过 Suspense 服务端起始标记；wrapper 本身按普通元素 hydrate。 */
function skipSuspenseStartMarker(): void {
  const cursor = hydrationCursor
  if (
    cursor != null &&
    cursor.nodeType === 8 &&
    (cursor as Comment).nodeValue === 'actview:suspense:start'
  ) {
    hydrationCursor = cursor.nextSibling
    if (cursor.parentNode) cursor.parentNode.removeChild(cursor)
  }
}

function removeSuspenseMarkers(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) {
      const value = (child as Comment).nodeValue
      if (
        value === 'actview:suspense:start' ||
        value === 'actview:suspense:end'
      ) {
        child.parentNode?.removeChild(child)
      }
    } else if (child.nodeType === 1) {
      removeSuspenseMarkers(child)
    }
  }
}


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

/**
 * 客户端 hydration：复用容器内已有 SSR DOM，绑定事件 / refs 并建立 render effect。
 *
 * 说明：Phase 3 支持元素 / 文本 / Fragment / 普通组件；Teleport / KeepAlive 等
 * 复杂边界暂按普通 patch 处理，后续阶段继续补标记与边界匹配。
 */
export function hydrate(vnode: VNode, container: Element): void {
  const host = container as ContainerElement
  hydrationCursor = container.firstChild
  hydrating = true
  try {
    patch(null, vnode, container, null, null)
    // Teleport 在整棵树 hydrate 后再迁移，避免目标容器 cleanup 删除迁入节点。
    for (const move of pendingTeleportMoves.splice(0)) {
      if (move.targetAnchor.parentNode !== move.target) {
        move.target.appendChild(move.targetAnchor)
      }
      let node = move.start.nextSibling
      while (node && node !== move.stop) {
        const next = node.nextSibling
        move.target.insertBefore(node, move.targetAnchor)
        node = next
      }
      if (move.endMarker?.parentNode) {
        move.endMarker.parentNode.removeChild(move.endMarker)
      }
    }
    removeSuspenseMarkers(container)
    host._vnode = vnode
  } finally {
    pendingTeleportMoves.length = 0
    hydrating = false
    hydrationCursor = null
  }
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
  } else if (getBuiltinKind(type) === 'teleport') {
    if (n1) patchTeleport(n1, n2, parent)
    else mountTeleport(n2, container, anchor, parent)
  } else if (getBuiltinKind(type) === 'transition') {
    processTransition(n1, n2, container, anchor, parent)
  } else if (isComponent(type)) {
    if (n1) updateComponent(n1, n2)
    else mountComponent(n2, container, anchor, parent)
  } else {
    throw new Error(`[actview] 无效的 VNode type：${String(type)}`)
  }
}

/** 渲染器识别的内置组件标记（`type.__builtin`；其余走普通元素 / 组件） */
type BuiltinKind = 'teleport' | 'transition'

/** 读取内置组件标记；普通标签 / 组件 / symbol 一律返回 null */
function getBuiltinKind(type: unknown): BuiltinKind | null {
  const builtin = (
    type as unknown as { __builtin?: unknown } | null | undefined
  )?.__builtin
  return builtin === 'teleport' || builtin === 'transition' ? builtin : null
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

  if (hydrating) {
    const existing = hydrationCursor
    if (existing && existing.nodeType === 3) {
      existing.nodeValue = text
      n2.el = existing
      hydrationCursor = existing.nextSibling
      return
    }
    if (existing) {
      hydrationMismatch('Text', existing)
      const el = document.createTextNode(text)
      n2.el = el
      existing.parentNode?.replaceChild(el, existing)
      hydrationCursor = el.nextSibling
      return
    }
    hydrationMismatch('Text', existing)
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
  if (hydrating) skipSuspenseStartMarker()
  const existing = hydrating ? hydrationCursor : null
  const tag = String(vnode.type)
  const matched =
    existing != null &&
    existing.nodeType === 1 &&
    (existing as Element).tagName.toLowerCase() === tag.toLowerCase()

  let el: Element
  let adopted = false
  if (hydrating && matched) {
    el = existing as Element
    adopted = true
  } else {
    if (hydrating) hydrationMismatch(`<${tag}>`, existing)
    el = createElement(tag)
    if (hydrating && existing) {
      // 基础 mismatch 恢复：用新节点替换服务端不匹配节点，避免留下重复 DOM。
      existing.parentNode?.replaceChild(el, existing)
      adopted = true
    }
  }
  // 先写 el：子节点挂载 / ref 处理都可能回读 vnode.el
  vnode.el = el

  const children = normalizeChildren(vnode.props?.children)
  vnode.children = children

  if (hydrating && adopted) {
    const outerCursor = el.nextSibling
    hydrationCursor = el.firstChild
    for (const child of children) patch(null, child, el, null, parent)
    // 服务端多出的子节点：mismatch 恢复时移除，避免重复内容。
    while (hydrationCursor && hydrationCursor !== outerCursor) {
      const next = hydrationCursor.nextSibling
      hydrationCursor.parentNode?.removeChild(hydrationCursor)
      hydrationCursor = next
    }
    hydrationCursor = outerCursor
  } else {
    for (const child of children) patch(null, child, el, null, parent)
  }

  // 属性 / class / style / 事件（children / key / ref 由各自路径处理）
  patchProps(el, null, vnode.props)

  const ref = resolveRef(vnode)
  if (ref != null) setRef(ref, el)

  if (!adopted) {
    container.insertBefore(el, anchor)
  }
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
    for (const child of children) {
      patch(null, child, container, anchor, parent)
    }
  } else {
    // 旧 Fragment 的 DOM 范围之后那个节点 = 新 children 的插入锚点；
    // 空 Fragment 无法从 DOM 反查，退回调用方传入的 anchor。
    patchChildren(n1, n2, container, getNextHostNode(n1) ?? anchor, parent)
  }

  n2.el = firstHostNodeIn(children)
}

/** children 中第一个拥有宿主节点的子项（空 / null 渲染组件会被跳过） */
function firstHostNodeIn(children: VNode[]): Node | null {
  for (const child of children) {
    const node = firstHostNode(child)
    if (node) return node
  }
  return null
}

// ------------------------------------------------------------
// 内置组件：Teleport（M3b / M3c 跨树锚点）
// ------------------------------------------------------------

/** Teleport vnode 上记录的目标容器锚点（children 挂它之前） */
type TeleportRuntime = { __teleportTargetAnchor?: Node | null }

/** 读取 Teleport vnode 在目标容器里的锚点注释 */
function getTeleportTargetAnchor(vnode: VNode): Node | null {
  return (
    (vnode as unknown as TeleportRuntime).__teleportTargetAnchor ?? null
  )
}

/**
 * Teleport：children 挂到 `props.to` 解析出的目标容器（selector / Element）。
 *
 * 两处锚点（注释节点）保证跨树顺序正确：
 * - parentAnchor：插在**父容器**里（= vnode.el），维持 Teleport 在父容器中的
 *   位置（后续兄弟节点的锚点 / getNextHostNode / moveHostNodes 都靠它）；
 * - targetAnchor：append 在目标容器里（= vnode.__teleportTargetAnchor），
 *   children 一律 patch 到它之前；多个 Teleport 指向同一目标时按挂载顺序
 *   append 各自的 targetAnchor，因此内容顺序稳定、更新只影响自己的区间。
 */
function mountTeleport(
  vnode: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const target = resolveTeleportTarget(vnode.props?.to)
  const children = normalizeChildren(vnode.props?.children)
  vnode.children = children

  // Hydration：复用 SSR 内联内容 + 边界标记，再迁移到 target。
  if (hydrating) {
    const cursor = hydrationCursor
    const hasStart =
      cursor != null &&
      cursor.nodeType === 8 &&
      (cursor as Comment).nodeValue === 'actview:teleport:start'
    const startMarker = hasStart
      ? (cursor as Comment)
      : document.createComment('teleport')
    if (hasStart) {
      hydrationCursor = startMarker.nextSibling
    } else {
      container.insertBefore(startMarker, cursor)
      hydrationCursor = startMarker.nextSibling
    }
    vnode.el = startMarker

    const targetAnchor = document.createComment('teleport')
    target.appendChild(targetAnchor)
    ;(vnode as unknown as TeleportRuntime).__teleportTargetAnchor = targetAnchor

    for (const child of children) {
      patch(null, child, container, startMarker, parent)
    }

    const afterChildren = hydrationCursor
    const endMarker =
      afterChildren != null &&
      afterChildren.nodeType === 8 &&
      (afterChildren as Comment).nodeValue === 'actview:teleport:end'
        ? (afterChildren as Comment)
        : null
    if (endMarker) hydrationCursor = endMarker.nextSibling

    pendingTeleportMoves.push({
      start: startMarker,
      stop: endMarker ?? afterChildren,
      target,
      targetAnchor,
      endMarker,
    })
    return
  }

  // 父容器占位注释：代表 Teleport 在父树中的位置（自身不产生可见 DOM）
  const parentAnchor = document.createComment('teleport')
  vnode.el = parentAnchor
  container.insertBefore(parentAnchor, anchor)

  // 目标容器锚点：children 挂到它之前
  const targetAnchor = document.createComment('teleport')
  target.appendChild(targetAnchor)
  ;(vnode as unknown as TeleportRuntime).__teleportTargetAnchor = targetAnchor

  for (const child of children) patch(null, child, target, targetAnchor, parent)
}

/**
 * Teleport 更新：
 * - 目标不变：children 在原 targetAnchor 前 diff（多个 Teleport 区间互不干扰）；
 * - `to` 变化：把旧 children 的宿主节点迁移到新目标（保留实例 / DOM），
 *   旧 targetAnchor 移除，新 targetAnchor append 到新目标后再 diff。
 */
function patchTeleport(
  n1: VNode,
  n2: VNode,
  parent: ComponentInternalInstance | null,
): void {
  const nextChildren = normalizeChildren(n2.props?.children)
  n2.children = nextChildren
  // 父容器占位注释随 vnode 复用（父容器位置不变）
  n2.el = n1.el

  const prevTarget = resolveTeleportTarget(n1.props?.to)
  const nextTarget = resolveTeleportTarget(n2.props?.to)
  const prevAnchor = getTeleportTargetAnchor(n1)

  if (prevTarget === nextTarget && prevAnchor) {
    ;(n2 as unknown as TeleportRuntime).__teleportTargetAnchor = prevAnchor
    patchChildren(n1, n2, nextTarget, prevAnchor, parent)
    return
  }

  // `to` 变化（或旧 anchor 缺失）：迁移到新目标
  const nextAnchor = document.createComment('teleport')
  nextTarget.appendChild(nextAnchor)

  // 1) 旧 children 的宿主节点按文档顺序搬到新 anchor 之前
  for (const child of getChildren(n1)) {
    for (const node of collectHostNodes(child)) {
      nextTarget.insertBefore(node, nextAnchor)
    }
  }
  // 2) 移除旧目标里的旧 anchor
  if (prevAnchor) removeNode(prevAnchor)
  ;(n2 as unknown as TeleportRuntime).__teleportTargetAnchor = nextAnchor
  // 3) 在新目标内做 children diff（位置对齐就地 patch，新增插到 anchor 前）
  patchChildren(n1, n2, nextTarget, nextAnchor, parent)
}

/** Teleport 卸载：卸载 children + 移除目标锚点 + 父容器占位注释 */
function unmountTeleport(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
): void {
  for (const child of getChildren(vnode)) unmount(child, parent)

  const targetAnchor = getTeleportTargetAnchor(vnode)
  if (targetAnchor) removeNode(targetAnchor)

  const parentAnchor = vnode.el as Node | null
  if (parentAnchor) removeNode(parentAnchor)

  ;(vnode as unknown as TeleportRuntime).__teleportTargetAnchor = null
  vnode.el = null
}

// ------------------------------------------------------------
// 内置组件：Transition（M3b）
// ------------------------------------------------------------

/**
 * Transition：单子节点（多子节点包成 Fragment），负责 enter / leave 编排。
 *
 * - mount：挂载子节点后调用 enter；
 * - update：子节点 type/key 变化 → 旧子节点离场完成后卸载 + 挂载新子节点 +
 *   enter；否则直接 patch 子节点；
 * - unmount：先离场，动画结束后再卸载子节点 DOM（延迟卸载）。
 *
 * vnode.el = 子节点范围的首个宿主节点；vnode.children = [子节点] 供更新 /
 * 卸载 / collectHostNodes 复用。
 */
function processTransition(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null,
  parent: ComponentInternalInstance | null,
): void {
  const prevChild = n1 ? transitionChild(n1) : null
  const nextChild = transitionChild(n2)
  const props = n2.props ?? {}

  // 无旧子节点：挂载 + enter
  if (!prevChild) {
    if (!nextChild) {
      n2.el = null
      return
    }
    patch(null, nextChild, container, anchor, parent)
    n2.el = nextChild.el
    transitionEnter(nextChild, props)
    return
  }

  // 新子节点消失：leave 完成后再卸载旧子节点
  if (!nextChild) {
    transitionLeave(prevChild, n1?.props ?? props, () => unmount(prevChild, parent))
    n2.el = null
    return
  }

  // 子节点类型 / key 变化：旧子节点 leave → 卸载旧 + 挂载新 + enter
  if (!isSameVNodeType(prevChild, nextChild)) {
    transitionLeave(prevChild, n1?.props ?? props, () => {
      unmount(prevChild, parent)
      patch(null, nextChild, container, anchor, parent)
      n2.el = nextChild.el
      transitionEnter(nextChild, props)
    })
    // 离场期间旧 DOM 仍在，el 暂指向旧子节点
    n2.el = prevChild.el
    return
  }

  // 同类型子节点：就地 patch（不重复进场）
  patch(prevChild, nextChild, container, anchor, parent)
  n2.el = nextChild.el
}

/**
 * Transition 子节点归一化（结果缓存在 vnode.children = [child]）：
 * - 0 个 → null；
 * - 1 个 → 该 VNode；
 * - 多个 → 包成 Fragment VNode，enter / leave 作用于其全部宿主元素。
 */
function transitionChild(vnode: VNode): VNode | null {
  if (Array.isArray(vnode.children)) {
    const cached = vnode.children as VNode[]
    if (cached.length === 0) return null
    if (cached.length === 1) return cached[0]
  }

  const children = normalizeChildren(vnode.props?.children)
  if (children.length === 0) {
    vnode.children = []
    return null
  }
  const child =
    children.length === 1 ? children[0] : createVNode(Fragment, { children })
  vnode.children = [child]
  return child
}

/** 子节点子树里的宿主元素（文本节点不参与 class 动画） */
function transitionElements(vnode: VNode): Element[] {
  const elements: Element[] = []
  for (const node of collectHostNodes(vnode)) {
    if (node.nodeType === 1) elements.push(node as Element)
  }
  return elements
}

/** 进场：对子节点全部宿主元素应用 enter 类名 */
function transitionEnter(
  child: VNode,
  props: Record<string, any>,
): void {
  for (const el of transitionElements(child)) applyTransitionEnter(el, props)
}

/**
 * 离场：对子节点全部宿主元素应用 leave 类名；全部完成后调用 done（卸载 DOM）。
 * 没有宿主元素时立即完成。
 */
function transitionLeave(
  child: VNode,
  props: Record<string, any> | null,
  done: () => void,
): void {
  const elements = transitionElements(child)
  if (elements.length === 0) {
    done()
    return
  }

  const leaveProps = props ?? {}
  let remaining = elements.length
  const finish = (): void => {
    if (--remaining === 0) done()
  }
  for (const el of elements) applyTransitionLeave(el, leaveProps, finish)
}

/** Transition 卸载：先离场，动画结束后再卸载子节点 */
function unmountTransition(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
): void {
  const child = transitionChild(vnode)
  if (!child) {
    vnode.el = null
    return
  }
  transitionLeave(child, vnode.props, () => unmount(child, parent))
  // DOM 在离场结束后由回调移除；vnode.el 保留到离场完成
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
 *      旧无 key 节点出现顺序复用），未命中标记为待挂载；复用节点记录
 *      「旧索引 + 1」序列（新节点 / type 变化需重建 DOM 的节点记 0）；
 *   ⑥ 卸载所有未被复用的旧节点；
 *   ⑦ 对「旧索引序列」求 LIS：从后往前，未命中的节点按锚点挂载，命中但不在
 *      LIS 上的复用节点 insertBefore 移动；LIS 上的节点保持原位（相对顺序已
 *      正确，无需 DOM 操作）。anchor 恒为「下一个新节点的首个宿主节点」
 *      （尾部回退到调用方 anchor）。
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
  /**
   * 中间段「旧索引 + 1」序列（对齐 Vue newIndexToOldIndexMap）：
   * - >0 = 该新位置复用了旧列表中的节点（值 = 旧索引 + 1）；
   * - 0 = 新节点，或 key 命中但 type 变化（旧 DOM 已被 patch 销毁重建），
   *   这类节点不参与 LIS（必须移动）。
   */
  const newIndexToOldIndex: number[] = []
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

    if (oldIndex < 0) {
      // 新增节点，第 ⑦ 步统一挂载
      newIndexToOldIndex.push(0)
      continue
    }

    reusedOldIndexes.add(oldIndex)
    reusedNewIndexes.add(i)
    // type 相同 → DOM 原地复用，可进 LIS；不同 → patch 内部卸载旧的再挂新的，
    // 新 DOM 暂落在 anchor 位置，必须移动（记 0，不参与 LIS）
    const domReused = isSameVNodeType(prevChildren[oldIndex], nextChild)
    // 复用：先 patch（type 不同时 patch 内部会卸载旧的再挂新的；新 DOM 暂可
    // 落在 anchor 位置，第 ⑦ 步统一移动到正确位置）
    patch(prevChildren[oldIndex], nextChild, container, anchor, parent)
    newIndexToOldIndex.push(domReused ? oldIndex + 1 : 0)
  }

  // ⑥ 卸载未被复用的旧节点
  for (let i = start; i <= prevEnd; i++) {
    if (!reusedOldIndexes.has(i)) unmount(prevChildren[i], parent)
  }

  // ⑦ LIS 求「保持原位」的新索引集合：不在集合中的复用节点才需要移动
  const stableIndexes = new Set<number>()
  for (const index of getSequence(newIndexToOldIndex)) {
    stableIndexes.add(index + start)
  }

  // 从后往前定位：anchor = 下一个已定位节点的首个宿主节点
  let nextAnchor = anchorFromIndex(nextChildren, nextEnd + 1, anchor)
  for (let i = nextEnd; i >= start; i--) {
    const nextChild = nextChildren[i]

    if (!reusedNewIndexes.has(i)) {
      // 新节点：直接挂载到 anchor 前（Fragment / 组件内部按锚点顺序插入）
      patch(null, nextChild, container, nextAnchor, parent)
    } else if (!stableIndexes.has(i)) {
      // 复用节点不在 LIS 上：移动到 anchor 前（已就位时 moveHostNodes 内部跳过）
      moveHostNodes(nextChild, container, nextAnchor)
    }
    // LIS 上的复用节点保持原位（相对顺序已正确，不做 DOM 操作）

    const firstHost = firstHostNode(nextChild)
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
  // KeepAlive 缓存复用：vnode 已带组件实例 → 激活路径（setup 不重跑）。
  // 由 keepAlive.ts 的渲染函数在缓存命中时返回「带 component 的缓存 vnode」触发。
  if (vnode.component) {
    activateKeptAlive(vnode, container, anchor)
    return
  }

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

  // ② setup 只执行一次（内部 pauseTracking + currentInstance 栈）。
  // setup 同步抛错：先走 errorCaptured / app.config.errorHandler；已被捕获时
  // 用 null 占位继续挂载（祖先 ErrorBoundary 稍后重渲染 fallback），未捕获上抛。
  let pending: Promise<RenderFunction> | null = null
  try {
    pending = setupComponent(instance)
  } catch (err) {
    if (!handleError(err, instance, 'setup')) throw err
    instance.render = () => null
  }

  // async setup：component.ts 已把 instance.render 置为 null 占位（首帧渲染空），
  // 这里向最近的 Suspense 注册（显示 fallback）；Promise resolve 后写入真实
  // render 并 queueJob 触发更新，resolve 后隐藏 fallback。
  if (pending) {
    const suspense = currentSuspense()
    suspense?.register()
    pending.then(
      (render) => {
        instance.render = render
        suspense?.resolve()
        queueJob(instance.job)
      },
      (err) => {
        suspense?.resolve()
        if (!handleError(err, instance, 'setup')) throw err
      },
    )
  }

  // ③ render effect + 首帧同步渲染
  setupRenderEffect(instance, container, anchor)

  // 组件 ref → 公开实例 proxy（元素 ref → DOM，在 mountElement 中处理）
  const ref = resolveRef(vnode)
  if (ref != null) setRef(ref, instance.proxy)

  // 注意：KeepAlive 内的**首次挂载**不触发 activated（激活钩子只在缓存 vnode
  // 重新挂载时由 activateKeptAlive 触发；m3c 验收按此语义计数）。

  // DevTools：首次挂载完成（hook 未注册时零开销）
  notifyDevtoolsComponent(instance, 'mount')
}

/**
 * 子树 patch 期间临时允许 render effect 自触发。
 *
 * 子组件挂载发生在父组件 render effect 的 RUNNING 期间；async setup 的
 * `Suspense.register()` 与 ErrorBoundary 的 `errorCaptured` 钩子会在这时写
 * 父组件的响应式状态（pending / error）。本版 reactivity（Vue 3.5 语义）对
 * RUNNING 效果默认忽略 notify，若不临时打开 ALLOW_RECURSE，Suspense 不会
 * 显示 fallback、ErrorBoundary 不会切到 fallback。
 *
 * 只包 patch、不包 renderComponentRoot：组件自身 render 期间写状态仍保持
 * 「忽略自触发」的既有语义（避免无限重渲染），只有子组件挂载/卸载引发的
 * 边界状态写入可以调度一轮重渲染。
 */
function patchWithRecurse<T>(
  instance: ComponentInternalInstance,
  patchFn: () => T,
): T {
  const effect = instance.effect
  effect.flags |= EffectFlags.ALLOW_RECURSE
  try {
    return patchFn()
  } finally {
    effect.flags &= ~EffectFlags.ALLOW_RECURSE
  }
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
    instance.renderCount++
    const perfStart = instance.appContext.config.performance
      ? now()
      : 0

    // ---- 首帧：同步挂载子树 ----
    if (!instance.isMounted) {
      invokeHooks(instance.beforeMount, instance)

      try {
        const subTree = renderComponentRoot(instance)
        instance.subTree = subTree
        patchWithRecurse(instance, () => {
          if (subTree) patch(null, subTree, container, anchor, instance)
        })
        instance.vnode.el = subTree ? subTree.el : null
      } catch (err) {
        // 渲染 / patch 抛错：先交给 errorCaptured / app.config.errorHandler。
        // 已被捕获 → 本组件保持空子树 + isMounted（祖先边界重渲染 fallback）；
        // 未捕获 → 继续上抛（首帧 mount 错误由 render()/mount() 抛出）。
        if (!handleError(err, instance, 'render')) throw err
        instance.subTree = null
        instance.vnode.el = null
        instance.isMounted = true
        return
      }

      instance.isMounted = true
      if (perfStart) {
        notifyDevtoolsPerformance(instance, 'mount', now() - perfStart)
      }
      // mounted 是 post hook：等整轮 patch 完成、DOM 就绪后执行
      // （子组件挂载先入队 → 子 mounted 先于父 mounted）
      queuePostFlushCb(() => invokeHooks(instance.mounted, instance))
      return
    }

    // ---- 更新：diff 旧子树 → 新子树 ----
    invokeHooks(instance.beforeUpdate, instance)

    const prevTree = instance.subTree
    const hostContainer = instanceContainer(instance)

    try {
      const nextTree = renderComponentRoot(instance)
      instance.subTree = nextTree

      patchWithRecurse(instance, () => {
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
      })
    } catch (err) {
      // 更新失败：回滚 subTree（保持下一次 diff 的旧树一致）；已被捕获则等
      // 祖先边界重渲染 fallback，未捕获继续上抛（scheduler 复位状态后抛出）
      instance.subTree = prevTree
      if (!handleError(err, instance, 'render')) throw err
      return
    }

    // DevTools：重渲染完成
    if (perfStart) {
      notifyDevtoolsPerformance(instance, 'update', now() - perfStart)
    }
    notifyDevtoolsComponent(instance, 'update')
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
    if (getDevtoolsHook()) {
      effect.onTrack = (event) => {
        notifyDevtoolsReactive(instance, 'track', {
          target: event.target,
          key: event.key,
          type: event.type,
        })
      }
      effect.onTrigger = (event) => {
        notifyDevtoolsReactive(instance, 'trigger', {
          target: event.target,
          key: event.key,
          type: event.type,
          newValue: event.newValue,
          oldValue: event.oldValue,
        })
      }
    }
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
    try {
      unmount(subTree, instance)
    } catch (err) {
      // 子树卸载抛错：同样走 errorCaptured / app.config.errorHandler
      if (!handleError(err, instance, 'unmount')) throw err
    } finally {
      instance.subTree = null
    }
  }

  queuePostFlushCb(() => invokeHooks(instance.unmounted, instance))

  setRef(resolveRef(instance.vnode), null)
  instance.isMounted = false
  vnode.el = null

  // DevTools：卸载完成
  notifyDevtoolsComponent(instance, 'unmount')
}

// ------------------------------------------------------------
// KeepAlive 集成（缓存 vnode 由 keepAlive.ts 打 __keepAlive 标记）
// ------------------------------------------------------------

/** keepAlive.ts 打在可缓存子 vnode 上的标记（renderer 只读 storage / cache） */
interface KeepAliveMarker {
  cache: Map<unknown, VNode>
  storage: Element
  key: unknown
  max?: number
}

/** 读取 vnode 的 KeepAlive 标记（非 KeepAlive 子节点 → null） */
function getKeepAliveMarker(vnode: VNode): KeepAliveMarker | null {
  return (
    (vnode as unknown as { __keepAlive?: KeepAliveMarker }).__keepAlive ?? null
  )
}

/**
 * 组件实例当前子树的全部宿主节点（文档顺序）。
 * 用共享的 ./hostNodes 收集：Fragment 多根 / 组件递归 / Transition 子节点都能
 * 正确处理（KeepAlive 多根缓存的基础）。
 */
function componentHostNodes(instance: ComponentInternalInstance): Node[] {
  return instance.subTree ? collectHostNodes(instance.subTree) : []
}

/**
 * 停用（缓存）组件：把子树**全部**宿主节点（多根 Fragment → 多个）移入
 * storage，实例 / 子树 / scope 全部保留，只触发 deactivated。
 *
 * 与原 unmountComponent 的区别：不 scope.stop()、不调用 unmounted、不卸载
 * 子树、不置空 vnode.el / vnode.component —— 缓存 vnode 再次挂载时由
 * activateKeptAlive 复用同一实例（setup 不重跑、状态保留）。
 */
function deactivateKeptAlive(vnode: VNode, marker: KeepAliveMarker): void {
  const instance = vnode.component as unknown as ComponentInternalInstance | null
  if (!instance) return

  // append 到 storage（detached 容器）→ 节点从页面移除但保持相对顺序
  for (const node of componentHostNodes(instance)) {
    marker.storage.appendChild(node)
  }

  // 写入 KeepAlive 缓存：下次 render 命中后用同一 vnode / 实例激活
  marker.cache.set(marker.key, vnode)

  // KeepAlive 自身卸载清理时缓存实例已被销毁（isMounted=false）→ 不再发 deactivated
  if (instance.isMounted) invokeHooks(instance.deactivated, instance)
}

/**
 * 激活缓存组件：全部宿主节点（多根 Fragment → 多个）从 storage 按顺序移回
 * container，复用原实例重新渲染并触发 activated（跳过 create 实例 / setup）。
 */
function activateKeptAlive(
  vnode: VNode,
  container: Element,
  anchor: Node | null,
): void {
  const instance = vnode.component as unknown as ComponentInternalInstance | null
  if (!instance) return

  // 从 storage 移回原容器（连续 insertBefore 保持多根相对顺序）
  for (const node of componentHostNodes(instance)) {
    container.insertBefore(node, anchor)
  }

  instance.vnode = vnode
  instance.container = container as unknown as ComponentInternalInstance['container']
  vnode.el = instance.subTree ? instance.subTree.el : null

  // 用最新 props / vnode 触发一次 render（scheduler 去重，异步刷盘）
  instance.update()
  invokeHooks(instance.activated, instance)
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

  // 内置组件（Teleport / Transition）：各自编排 DOM 卸载
  const builtin = getBuiltinKind(type)
  if (builtin === 'teleport') {
    unmountTeleport(vnode, parent)
    return
  }
  if (builtin === 'transition') {
    unmountTransition(vnode, parent)
    return
  }

  if (isComponent(type)) {
    // KeepAlive 缓存复用中的组件：不真正卸载
    // （宿主节点入 storage + deactivated；实例 / 子树 / scope 全部保留）
    const marker = getKeepAliveMarker(vnode)
    if (vnode.component && marker) {
      deactivateKeptAlive(vnode, marker)
      return
    }
    unmountComponent(vnode)
  }
}

// ------------------------------------------------------------
// 锚点 / 子节点工具
// ------------------------------------------------------------

/**
 * VNode 的宿主 DOM 范围之后的那个节点（插入锚点 / 更新定位用）。
 * 宿主节点规则统一由 ./hostNodes 决定（Fragment 多节点 / 组件 subTree /
 * Teleport 父容器占位注释 / Transition 子节点）。
 */
function getNextHostNode(vnode: VNode): Node | null {
  const last = lastHostNode(vnode)
  return last ? last.nextSibling : null
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
    const first = firstHostNode(children[i])
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
    const first = firstHostNode(children[i])
    if (first) return first
  }
  return fallback
}

/**
 * 最长递增子序列（返回下标数组）。
 *
 * 入参是「旧索引 + 1」序列（0 = 新节点，跳过）。返回的下标集合 = 相对顺序
 * 已经正确、无需移动的节点；keyed 中间段只移动不在该集合中的复用节点，
 * 把 DOM 移动次数降到最小（对齐 Vue 3 getSequence：贪心 + 二分 + 前驱回溯）。
 */
function getSequence(arr: number[]): number[] {
  const predecessors = arr.slice() // 前驱链：predecessors[i] = 子序列中 i 的前一个下标
  const tails: number[] = [] // tails[k] = 长度为 k+1 的递增子序列末尾元素下标

  for (let i = 0; i < arr.length; i++) {
    const value = arr[i]
    if (value === 0) continue // 新节点 / 重建 DOM 的节点不参与 LIS

    // 二分查找第一个「末尾值 >= value」的位置
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (arr[tails[middle]] < value) low = middle + 1
      else high = middle
    }
    if (low > 0) predecessors[i] = tails[low - 1]
    tails[low] = i
  }

  // 从最后一个尾巴回溯前驱链，还原真实子序列下标
  let length = tails.length
  let cursor = tails[length - 1]
  while (length-- > 0) {
    tails[length] = cursor
    cursor = predecessors[cursor]
  }
  return tails
}

// ------------------------------------------------------------
// M3 集成钩子：Suspense 上下文 / DevTools 埋点
// ------------------------------------------------------------

/** Suspense 上下文（suspense.ts 的 getCurrentSuspense 返回实例或 ctx，两种都兼容） */
interface SuspenseContextLike {
  register(): void
  resolve(): void
}

/** 当前最近 Suspense 的 register/resolve（不在 Suspense 内 → null） */
function currentSuspense(): SuspenseContextLike | null {
  const suspense = getCurrentSuspense() as unknown
  if (suspense == null) return null

  const ctx =
    (suspense as { suspenseCtx?: SuspenseContextLike }).suspenseCtx ??
    (suspense as SuspenseContextLike)
  return ctx != null &&
    typeof ctx.register === 'function' &&
    typeof ctx.resolve === 'function'
    ? ctx
    : null
}

/** 性能计时（无 performance 环境下退回 Date.now） */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
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
  let text = ''
  const flushText = (): void => {
    if (!text) return
    result.push(createTextVNode(text))
    text = ''
  }
  for (const child of flat) {
    if (child == null || typeof child === 'boolean') continue
    if (typeof child === 'string' || typeof child === 'number') {
      // 相邻文本合并为一个 Text：与服务端 HTML 的文本节点形态一致，
      // 也让 hydration 后的 diff 能复用同一个 DOM text node。
      text += String(child)
      continue
    }
    flushText()
    if (isVNode(child)) {
      if (child.type === Text) {
        text += String(child.props?.text ?? '')
      } else {
        result.push(child)
      }
      continue
    }
    throw new Error(
      `[actview] 无效的子节点：期望 VNode / string / number / null，当前为 ${typeof child}`,
    )
  }
  flushText()
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
