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
import { resetIdState } from './lifecycle'

/** 游标：指向容器内下一个待消费的 DOM 节点 */
export interface HydrateCursor {
  node: ChildNode | null
}

/** 客户端水合入口：容器已有 SSR 输出的 DOM */
export function hydrate(vnode: any, container: Element) {
  resetComponentUid()
  resetIdState()
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

  // Fragment：无自身 DOM，直接递归 children（游标不消费）
  if (type === Fragment) {
    return hydrateChildren(vnode.props?.children, container, cursor, parent)
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
  // solid 黑盒：SSR 未输出 → 重建（追加到容器末尾）
  if (vnode.$$typeof === SOLID_TYPE) {
    warnMismatch('solid 块无法水合，整块重建')
    return mountSolid(vnode, container)
  }
  // Teleport / Transition：SSR 输出的是其渲染结果而非专用结构 → 重建
  if (vnode.type?.__builtin === 'teleport' || vnode.type?.__builtin === 'transition') {
    warnMismatch(`${vnode.type.__builtin} 无法水合，重建`)
    return mountVNode(vnode, container, parent)
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

/** 容器 children 按序水合（与 renderer patchChildren 同构的归一化） */
function hydrateChildren(
  children: any,
  container: Element,
  cursor: HydrateCursor,
  parent: any
): any[] {
  const list = normalizeChildren(children)
  const out: any[] = []
  for (const child of list) {
    out.push(hydrateRoot(toVNode(child), container, cursor, parent))
  }
  return out
}
