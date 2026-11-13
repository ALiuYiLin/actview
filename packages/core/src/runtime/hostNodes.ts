// ============================================================
// 宿主节点工具 — VNode 子树 → 真实 DOM 节点集合（renderer / keepAlive 共用）
//
// 一个 VNode 可能对应 0 个、1 个或多个宿主 DOM 节点：
//   - Text / 元素（string 标签）→ [vnode.el]
//   - Fragment → 各 children 的宿主节点（按文档顺序展平）
//   - 组件 → 递归 instance.subTree（组件根可能是 Fragment / 渲染 null）
//   - Transition → 递归其子节点（单子节点或包成 Fragment 的多子节点）
//   - Teleport → 只有父容器里的**占位注释**（parentAnchor）属于本树；
//     真实内容渲染在目标容器（可能在本树之外），不参与本树的锚点 / 移动 / 移除
//   - 渲染 null 的组件 / 空 Fragment → []
//
// 抽成独立模块的原因：keepAlive.ts 需要按「全部宿主节点」移动 / 删除缓存组件
// （支持 Fragment 多根），而 renderer 的锚点 / 移动 / 卸载也需要同一套递归规则，
// 两处必须保持一致（且 hostNodes 不能反向依赖 renderer，避免循环 import）。
// ============================================================

import { isComponent } from '../internal'
import {
  Fragment,
  Text,
  isVNode,
  type VNode,
} from '../internal'

/** 收集 VNode 子树的全部宿主 DOM 节点（文档顺序） */
export function collectHostNodes(vnode: VNode): Node[] {
  const out: Node[] = []
  collect(vnode, out)
  return out
}

/** 子树第一个宿主节点（渲染 null / 空树 / 空 Teleport 外的空 → null） */
export function firstHostNode(vnode: VNode): Node | null {
  const nodes = collectHostNodes(vnode)
  return nodes.length > 0 ? nodes[0] : null
}

/** 子树最后一个宿主节点（用于取范围之后的插入锚点） */
export function lastHostNode(vnode: VNode): Node | null {
  const nodes = collectHostNodes(vnode)
  return nodes.length > 0 ? nodes[nodes.length - 1] : null
}

// ------------------------------------------------------------
// 内部递归
// ------------------------------------------------------------

/** 内置组件标记（与 renderer 的 __builtin 约定一致） */
type BuiltinKind = 'teleport' | 'transition'

function getBuiltinKind(type: unknown): BuiltinKind | null {
  const builtin = (
    type as unknown as { __builtin?: unknown } | null | undefined
  )?.__builtin
  return builtin === 'teleport' || builtin === 'transition' ? builtin : null
}

function collect(vnode: VNode, out: Node[]): void {
  const { type } = vnode
  const builtin = getBuiltinKind(type)

  // Teleport：本树只拥有父容器里的占位注释；内容在目标容器，不属于本树范围
  if (builtin === 'teleport') {
    pushNode(vnode.el, out)
    return
  }

  // Transition：宿主节点 = 子节点范围（可能是 Fragment 多节点）
  if (builtin === 'transition') {
    collectChildren(vnode, out)
    return
  }

  if (type === Fragment) {
    collectChildren(vnode, out)
    return
  }

  if (isComponent(type)) {
    const instance = vnode.component
    if (instance?.subTree) collect(instance.subTree, out)
    else pushNode(vnode.el, out)
    return
  }

  // Text / 元素（含 string 标签）
  pushNode(vnode.el, out)
}

/** 递归 vnode.children（渲染器挂载后该字段是展平的 VNode[]；这里对嵌套数组兜底） */
function collectChildren(vnode: VNode, out: Node[]): void {
  collectChildrenValue(vnode.children, out)
}

function collectChildrenValue(value: unknown, out: Node[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectChildrenValue(item, out)
    return
  }
  if (isVNode(value)) collect(value, out)
}

function pushNode(el: unknown, out: Node[]): void {
  if (el) out.push(el as Node)
}
