// ============================================================
// hydrate — 服务端渲染 HTML 的客户端水合
//   复用服务端输出的 DOM：只绑定事件/修正属性/建立组件实例，
//   不重建元素（首屏无 FOUC、保留 SSR 内容）。
//
// 模型：游标配对（cursor）——hydrateRoot 沿 vnode 树递归，
//   container 的 children 按序与 cursor 指向的 DOM 节点配对：
//   - 元素：校验 tagName → 匹配则复用（patchProps 全量 setProp：
//     事件绑定 + 属性修正，客户端优先幂等）；不匹配 → 告警 + 原位重建
//   - 文本：校验文本节点 + textContent；不一致 → 告警 + 客户端覆盖
//   - Fragment：无自身 DOM，直接递归 children
//   - 组件：复用 mountComponent（首帧走 hydrate 分支，子树与既有 DOM 配对）
//   - solid 块 / Teleport / Transition：SSR 无对应结构 → 告警 + 重建
//   每个容器水合结束清理剩余节点（服务端多输出的）。
//
// useId 一致性：hydrate 入口重置组件 uid + useId 计数，
//   SSR（renderToString 遍历序 id）与客户端（mount 遍历序 uid）对齐。
// ============================================================

import {
  mountVNode,
  isComponentVNode,
  patchProps,
  normalizeChildren,
  toVNode,
  applyRef,
  patch,
  Fragment,
  Text,
} from './renderer'
import { mountComponent, resetComponentUid } from './mountComponent'
import { mountSolid, SOLID_TYPE } from './solid'
import { getChildren } from '../vnode'
import { resolveTeleportTarget } from './transition'

/** 游标：指向容器内下一个待消费的 DOM 节点 */
export interface HydrateCursor {
  node: ChildNode | null
}

/** 客户端水合入口：容器已有 SSR 输出的 DOM */
export function hydrate(vnode: any, container: Element) {
  resetComponentUid()
  const cursor: HydrateCursor = { node: container.firstChild as ChildNode | null }
  hydrateRoot(vnode, container, cursor, null)
  cleanupRemaining(container, cursor)
}

/** 删除容器内游标之后的剩余节点（服务端多输出的） */
function cleanupRemaining(container: Element, cursor: HydrateCursor) {
  let n = cursor.node
  while (n) {
    const next = n.nextSibling
    n.remove()
    n = next
  }
  void container
}

function warnMismatch(msg: string) {
  console.warn('[actview] hydrate 不匹配（客户端优先重建）:', msg)
}

/**
 * 子树水合入口（组件首帧经 mountComponent deps.hydrateVNode 注入调用）：
 * 按 vnode 类型与 cursor 指向的 DOM 配对，返回 vnode.el（或 null）。
 */
export function hydrateRoot(
  vnode: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any {
  if (vnode == null || typeof vnode === 'boolean') return null
  if (Array.isArray(vnode)) {
    // 防御：组件子树已在 mountComponent 归一化为 Fragment
    return hydrateChildren(vnode, container, cursor, parent)
  }
  const { type } = vnode

  // solid 黑盒：SSR 未输出 → 重建（追加到容器末尾）
  if (vnode.$$typeof === SOLID_TYPE) {
    warnMismatch('solid 块无法水合，整块重建')
    return mountSolid(vnode, container)
  }
  // 内置组件（优先于组件分支，与 mountVNode 顺序一致）：
  //   Transition 的 SSR 输出是其渲染结果 → 子树配对，跳过 appear 动画
  //   Teleport：SSR 内联输出 → 当前位置配对后移动 DOM 到目标
  if (vnode.type?.__builtin === 'transition') {
    return hydrateTransition(vnode, container, cursor, parent)
  }
  if (vnode.type?.__builtin === 'teleport') {
    return hydrateTeleport(vnode, container, cursor, parent)
  }
  // Fragment：无自身 DOM，直接递归 children（游标不消费）——
  // 记录 __avChildren（vnode 数组）供后续 patch 精确 diff（与 mountVNode 一致）
  if (type === Fragment) {
    vnode.el = null
    vnode.__avChildren = hydrateChildren(
      vnode.props?.children,
      container,
      cursor,
      parent
    )
    return vnode.__avChildren
  }
  // 文本
  if (type === Text) {
    return hydrateText(vnode, container, cursor)
  }
  // 组件：复用 mountComponent（首帧 hydrate 分支），实例 ref 照常 applyRef
  if (isComponentVNode(vnode)) {
    mountComponent(vnode, container, parent, {
      patch,
      applyRef,
      hydrate: { cursor, container },
      hydrateVNode: hydrateRoot,
    })
    return vnode.el
  }
  // 原生元素
  if (typeof type !== 'string') return null
  return hydrateElement(vnode, container, cursor, parent)
}

/** 元素水合：校验 tagName，匹配则复用（事件绑定 + 属性修正 + children 递归） */
function hydrateElement(
  vnode: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any {
  const dom = cursor.node
  if (!dom || dom.nodeType !== 1 || (dom as Element).tagName.toLowerCase() !== vnode.type) {
    // 不匹配：客户端优先，原位重建（后续兄弟配对不受影响）
    warnMismatch(
      `期望 <${vnode.type}>，实际 ${dom ? dom.nodeName : '无节点'}`
    )
    const next = dom?.nextSibling ?? null
    if (dom) dom.remove()
    cursor.node = next
    return mountVNode(vnode, container, parent, next)
  }
  const el = dom as Element
  vnode.el = el
  // class 差异检测（调试辅助）：SSR 输出与客户端 props 不一致时告警，
  //  patchProps 仍客户端优先覆盖。其余属性不做 DOM 读比较（setProp 语义
  //  boolean/value/checked 等复杂，DOM 读比较易误报）。
  warnClassDiff(el, vnode.props)
  // 全量 setProp：事件绑定 + 属性修正（SSR 输出与客户端 props 一致时幂等；
  // 不一致时客户端优先覆盖——对齐 React 水合语义）
  patchProps(null, vnode.props, el)
  applyRef(vnode.props?.ref, el)
  // children 水合（dangerouslySetInnerHTML：SSR 已注入，跳过）
  const hasDanger = vnode.props?.dangerouslySetInnerHTML != null
  if (hasDanger) {
    vnode.__avChildren = []
  } else {
    const childCursor: HydrateCursor = { node: el.firstChild as ChildNode | null }
    vnode.__avChildren = hydrateChildren(vnode.props?.children, el, childCursor, parent)
    cleanupRemaining(el, childCursor)
  }
  // 游标推进到元素之后
  cursor.node = dom.nextSibling
  return el
}

/** 文本水合：空文本不消费；非文本/缺失 → 原位重建；内容不一致 → 客户端覆盖 */
function hydrateText(vnode: any, container: Element, cursor: HydrateCursor): any {
  if (vnode.props.text === '') {
    vnode.el = null
    return null
  }
  const dom = cursor.node
  if (!dom || dom.nodeType !== 3) {
    warnMismatch(`期望文本「${vnode.props.text}」`)
    const next = dom?.nextSibling ?? null
    if (dom) dom.remove()
    cursor.node = next
    const el = document.createTextNode(vnode.props.text)
    if (next) container.insertBefore(el, next)
    else container.appendChild(el)
    vnode.el = el
    return el
  }
  if (dom.textContent !== vnode.props.text) {
    warnMismatch(
      `文本不一致：SSR「${dom.textContent}」vs 客户端「${vnode.props.text}」`
    )
    dom.textContent = vnode.props.text
  }
  vnode.el = dom
  cursor.node = dom.nextSibling
  return dom
}

/** 容器 children 按序水合（与 renderer patchChildren 同构的归一化）。
 * 返回 **vnode 数组**（每项 el 已由 hydrateRoot 设置为配对后的 DOM，
 * 与 mountVNode 的 __avChildren 契约一致——后续 patch 精确 diff 复用）。 */
function hydrateChildren(
  children: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any[] {
  const list = normalizeChildren(children)
  const out: any[] = []
  for (const child of list) {
    const vnode = toVNode(child)
    hydrateRoot(vnode, container, cursor, parent)
    out.push(vnode)
  }
  return out
}

/** Transition 水合：单子节点子树配对（SSR 已输出其渲染结果），跳过 appear 动画 */
function hydrateTransition(
  vnode: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any {
  const children = getChildren(vnode)
  const child = Array.isArray(children) ? children[0] : children
  const cv = toVNode(child)
  const out = hydrateRoot(cv, container, cursor, parent)
  vnode.el = null
  vnode.__avChildren = cv ? [cv] : []
  return out
}

/** Teleport 水合：SSR 内联输出 → 当前位置配对（绑定事件）后，把 DOM 移动到
 *  to 目标容器（appendChild 移动保留事件监听）。to 为 null = 内联（不移动）；
 *  目标不存在 → 内容留在原位 + 告警（对齐 mountTeleport 的告警语义）。 */
function hydrateTeleport(
  vnode: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any {
  vnode.el = null
  const out = hydrateChildren(getChildren(vnode), container, cursor, parent)
  vnode.__avChildren = out
  const to = vnode.props?.to
  if (to != null) {
    const target = resolveTeleportTarget(to, container)
    if (target) {
      // 收集子树全部 DOM（Fragment/组件多根）→ 移动到目标（保留监听）
      const els: Node[] = []
      collectEls(out, els)
      for (const el of els) {
        if (el.parentNode && el.parentNode !== target) target.appendChild(el)
      }
    } else {
      warnMismatch(`Teleport 目标容器不存在（${String(to)}），内容留在原位`)
    }
  }
  return null
}

/** 递归收集 vnode 列表中的真实 DOM（组件/Fragment 多根嵌套，vnode.el） */
function collectEls(list: any[], out: Node[]) {
  for (const n of list) {
    if (!n) continue
    if (Array.isArray(n)) collectEls(n, out)
    else if (n.el) out.push(n.el)
  }
}

/** class 差异检测：SSR 输出的 class 与客户端 props 不一致时告警（仅调试辅助，
 *  patchProps 仍客户端优先覆盖）。class 语义简单（字符串），不易误报。 */
function warnClassDiff(el: Element, props: Record<string, any> | null | undefined) {
  if (!props) return
  const key = 'class' in props ? 'class' : 'className' in props ? 'className' : null
  if (!key) return
  const client = typeof props[key] === 'string' ? props[key] : ''
  const ssr = el.getAttribute('class')
  if (ssr !== client && ssr !== null) {
    warnMismatch(`class 不一致：SSR「${ssr}」vs 客户端「${client}」`)
  }
}
