// ============================================================
// Transition / Teleport — 内置组件
//   处置决策：Teleport 完整实现（DOM 传送）；Transition 最小可用
//   （进入/离开过渡类 + transitionend/时长兜底，无 mode/多子节点等高级语义）
//
// 识别方式：vnode.type 为标记对象（带 __builtin + __setup 形状，
//   满足 isComponentVNode 的组件判定，但 renderer 在组件分支之前优先
//   走 __builtin 内置分支）
//
// 依赖注入：本模块不 import renderer（避免循环依赖导致 vite-node
//   顶层解构拿到 undefined）；renderer 完成评估后调用 bindPatchChildren
//   注入 patchChildren，挂载/更新 children 时经注入函数调用
// ============================================================

/** renderer 注入的 patchChildren（挂载/更新 children 的核心） */
let _patchChildren: ((...args: any[]) => any[]) | null = null

/** 由 renderer 在自身模块评估完成后调用 */
export function bindPatchChildren(fn: (...args: any[]) => any[]) {
  _patchChildren = fn
}

// ------------------------------------------------------------
// Teleport：把 children 渲染到指定容器（to 选择器/元素/null=内联）
// ------------------------------------------------------------

export const Teleport = /* @__PURE__ */ {
  __builtin: 'teleport',
  __setup: () => () => null, // 仅满足组件形状；实际渲染走内置分支
} as any

/** 解析 to：选择器 =》 元素；Element =》 原样；null/未定义 =》 当前容器（内联） */
function resolveTeleportTarget(to: any, fallback: Element | null): Element | null {
  if (to == null) return fallback
  if (typeof to === 'string') return document.querySelector(to)
  if (to instanceof Element || (to && to.nodeType === 1)) return to
  return fallback
}

/** 挂载 Teleport：children 挂到目标容器，记录挂载节点以便卸载/迁移 */
export function mountTeleport(vnode: any, container: Element | null) {
  const target = resolveTeleportTarget(vnode.props?.to, container)
  vnode.el = null
  if (!target) {
    console.warn('[actview] Teleport: 目标容器不存在，跳过渲染')
    return null
  }
  vnode.__avChildren = patchChildrenSafe(null, vnode.props?.children, target)
  return null
}

/** 更新 Teleport：to 变化 =》 迁移 DOM；children 变化 =》 目标容器上 patch */
export function patchTeleport(oldVnode: any, newVnode: any, container: Element | null) {
  const oldTarget = resolveTeleportTarget(oldVnode.props?.to, container)
  const newTarget = resolveTeleportTarget(newVnode.props?.to, container)
  if (oldTarget && newTarget && oldTarget !== newTarget) {
    // 目标变化：把旧 DOM 迁移到新目标（先移动再继续 patch）
    const nodes = oldVnode.__avChildren ?? []
    for (const n of nodes) if (n?.el?.parentNode) newTarget.appendChild(n.el)
  }
  newVnode.el = null
  const base = newTarget ?? oldTarget ?? container
  if (base) {
    newVnode.__avChildren = patchChildrenSafe(
      oldVnode.props?.children,
      newVnode.props?.children,
      base,
      oldVnode,
    )
  }
}

/** 卸载 Teleport：从目标容器移除挂载的 DOM */
export function unmountTeleport(vnode: any) {
  const nodes = vnode.__avChildren ?? []
  for (const n of nodes) {
    if (n && n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el)
  }
  vnode.__avChildren = []
}

// ------------------------------------------------------------
// Transition：单子节点进入/离开过渡
//   - 进入：插入 DOM =》 +enter-from/-active =》 rAF×2 =》 +enter-to =》 清理
//   - 离开：+leave-from/-active =》 rAF×2 =》 +leave-to =》 transitionend/时长兜底 =》 移除 DOM
//   - 无过渡时长（transitionDuration 为 0s，含 happy-dom/无样式场景）=》 立即完成
// ------------------------------------------------------------

export const Transition = /* @__PURE__ */ {
  __builtin: 'transition',
  __setup: () => () => null, // 仅满足组件形状；实际渲染走内置分支
} as any

/** 获取元素生效的过渡时长（秒）；0 = 无过渡 =》 立即完成 */
function getTransitionDuration(el: Element): number {
  const s = window.getComputedStyle(el)
  const d = parseFloat(s.transitionDuration || '0')
  return isNaN(d) ? 0 : d
}

/**
 * 生效时长（毫秒）：优先 props.duration（显式，Vue 的 :duration 语义），
 * 否则读 CSS transition 时长；0 = 无过渡 =》 立即完成
 */
function resolveDuration(props: any): number {
  const explicit = props?.duration
  if (typeof explicit === 'number' && explicit >= 0) return explicit
  return 0
}

/** 双 rAF（Vue 同款：确保 enter-from 类生效后再切到 enter-to） */
function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** 等待 transitionend 或时长兜底 */
function waitForEnd(el: Element, ms: number, onDone: () => void) {
  if (ms <= 0) {
    onDone() // 无过渡：立即完成（同步）
    return
  }
  let done = false
  const finish = () => {
    if (done) return
    done = true
    el.removeEventListener('transitionend', finish)
    onDone()
  }
  el.addEventListener('transitionend', finish)
  // 兜底：时长 + 100ms，防 transitionend 不触发
  setTimeout(finish, ms + 100)
}

function addClass(el: Element, ...names: string[]) {
  for (const n of names) el.classList.add(n)
}
function removeClass(el: Element, ...names: string[]) {
  for (const n of names) el.classList.remove(n)
}

/** 播放进入动画（fire-and-forget） */
export function playEnter(el: Element, name: string, duration?: number) {
  const base = name || 'v'
  addClass(el, `${base}-enter-from`, `${base}-enter-active`)
  doubleRaf().then(() => {
    removeClass(el, `${base}-enter-from`)
    addClass(el, `${base}-enter-to`)
    const ms = duration ?? getTransitionDuration(el) * 1000
    waitForEnd(el, ms, () => {
      removeClass(el, `${base}-enter-to`, `${base}-enter-active`)
    })
  })
}

/** 播放离开动画，结束后回调（onDone 里执行真实卸载） */
export function playLeave(el: Element, name: string, duration: number, onDone: () => void) {
  const base = name || 'v'
  addClass(el, `${base}-leave-from`, `${base}-leave-active`)
  doubleRaf().then(() => {
    removeClass(el, `${base}-leave-from`)
    addClass(el, `${base}-leave-to`)
    waitForEnd(el, duration, onDone)
  })
}

/**
 * 挂载 Transition：挂载单子节点 + 进入动画
 * 返回被挂载的子 vnode（供后续 leave 拦截）
 */
export function mountTransition(vnode: any, container: Element | null) {
  const children = normalizeSingle(vnode.props?.children)
  vnode.el = null
  if (!children) return null
  const child = toVNodeSafe(children)
  patchChildrenSafe(null, [child], container)
  const el = child?.el
  if (el) playEnter(el, vnode.props?.name, resolveDuration(vnode.props))
  vnode.__avChildren = [child]
  return null
}

/**
 * 更新 Transition：子节点变化时旧节点播 leave（延迟卸载）+ 新节点进入。
 * 注意：此处不调用通用 unmount（会同步删 DOM），旧节点 DOM 由
 * leave 完成后移除；组件树整体卸载时（unmountTransition）直接卸载。
 */
export function patchTransition(
  oldVnode: any,
  newVnode: any,
  container: Element | null,
) {
  const name = newVnode.props?.name
  const oldChildren = oldVnode.__avChildren ?? []
  const newChildren = normalizeSingle(newVnode.props?.children)
  newVnode.el = null
  newVnode.__avChildren = []
  if (newChildren == null) {
    // 子节点被移除：旧节点播 leave 后卸载
    for (const oc of oldChildren) {
      const el = oc?.el
      if (el && el.parentNode) {
        playLeave(el, name, resolveDuration(newVnode.props), () => {
          if (el.parentNode) el.parentNode.removeChild(el)
        })
      }
    }
    return
  }
  const newChild = toVNodeSafe(newChildren)
  patchChildrenSafe(null, [newChild], container)
  const newEl = newChild?.el
  if (newEl) playEnter(newEl, name, resolveDuration(newVnode.props))
  newVnode.__avChildren = [newChild]
  // 旧节点：与新的不是同一节点 =》 播 leave 延迟卸载
  for (const oc of oldChildren) {
    if (oc === newChild || oc?.el === newEl) continue
    const el = oc?.el
    if (el && el.parentNode) {
      playLeave(el, name, resolveDuration(newVnode.props), () => {
        if (el.parentNode) el.parentNode.removeChild(el)
      })
    }
  }
}

/** 卸载 Transition（组件树整体拆除）：直接卸载子节点，无动画 */
export function unmountTransition(vnode: any) {
  const nodes = vnode.__avChildren ?? []
  for (const n of nodes) {
    if (n && n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el)
  }
  vnode.__avChildren = []
}

// ------------------------------------------------------------
// 工具（避免与 renderer 内部函数耦合：renderer 只传普通 children）
// ------------------------------------------------------------

/** 单子节点归一化：取第一个子节点（Transition 只支持单子节点） */
function normalizeSingle(children: any): any {
  if (children == null || typeof children === 'boolean') return null
  const arr = Array.isArray(children) ? children : [children]
  const real = arr.filter((c) => c != null && c !== false && c !== true)
  if (real.length > 1) {
    console.warn('[actview] Transition 只支持单个子节点，取第一个')
  }
  return real[0] ?? null
}

/** 把 children 包装为 vnode（字符串 =》 文本 vnode） */
function toVNodeSafe(child: any): any {
  if (child != null && typeof child === 'object' && child.$$typeof) return child
  if (typeof child === 'string' || typeof child === 'number') {
    return { $$typeof: Symbol.for('react.element'), type: Symbol.for('react.text'), key: null, ref: null, props: { text: String(child) } }
  }
  return child
}

/** 简化 children patch：挂载/更新到目标容器，返回 vnode 列表（带 el） */
function patchChildrenSafe(oldChildren: any, newChildren: any, container: Element | null, oldVnode?: any): any[] {
  if (!container) return []
  if (!_patchChildren) {
    console.warn('[actview] Transition/Teleport: renderer 未注入 patchChildren')
    return []
  }
  return _patchChildren(oldChildren, newChildren, container, oldVnode)
}
