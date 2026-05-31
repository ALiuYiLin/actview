// ============================================================
// jsx / jsxs / jsxDEV 核心实现
// 将 JSX 编译产出的调用转为 Vue 风格的 VNode
// ============================================================
import { createVNode, Fragment, type VNode, type VNodeChildren, type VNodeKey } from './types'

// ============================================================
// 从 props 中提取 children 和 key
// ============================================================
function normalizeProps(
  props: Record<string, unknown> | null,
  key: VNodeKey,
): {
  normalizedProps: Record<string, unknown> | null
  extractedChildren: VNodeChildren | null
  resolvedKey: VNodeKey
  ref: unknown
} {
  if (!props) {
    return {
      normalizedProps: null,
      extractedChildren: null,
      resolvedKey: key,
      ref: null,
    }
  }

  // 分离 children / key / ref
  const { children: propChildren, key: propKey, ref: propRef, ...restProps } = props

  // key 优先级：显式参数 > props.key
  const resolvedKey = key ?? (propKey as VNodeKey) ?? null
  const ref = propRef ?? null

  // 处理 children 归一化
  let extractedChildren: VNodeChildren | null = null

  if (propChildren !== undefined) {
    extractedChildren = normalizeVNodeChildren(propChildren)
  }

  // 如果剩余的 props 为空，设为 null
  const restKeys = Object.keys(restProps)
  const normalizedProps = restKeys.length > 0 ? (restProps as Record<string, unknown>) : null

  return {
    normalizedProps,
    extractedChildren,
    resolvedKey,
    ref,
  }
}

// ============================================================
// 子节点归一化：统一压平为数组 / 处理文本
// ============================================================
function normalizeVNodeChildren(rawChildren: unknown): VNodeChildren | null {
  if (rawChildren == null || rawChildren === false || rawChildren === true) {
    return null
  }

  // 已经是 VNode
  if (isVNode(rawChildren)) {
    return rawChildren
  }

  // 字符串 / 数字
  if (typeof rawChildren === 'string' || typeof rawChildren === 'number') {
    return String(rawChildren)
  }

  // 数组 — 逐项归一化
  if (Array.isArray(rawChildren)) {
    const result: unknown[] = []
    for (const child of rawChildren) {
      if (child == null || child === false || child === true) continue
      if (typeof child === 'string' || typeof child === 'number') {
        result.push(String(child))
      } else if (isVNode(child)) {
        result.push(child)
      } else if (Array.isArray(child)) {
        // 递归展开嵌套数组（JSX 静态子节点可能产生嵌套）
        flattenChildren(child, result)
      }
      // 其余忽略
    }
    if (result.length === 0) return null
    if (result.length === 1) return result[0] as VNodeChildren
    return result as VNodeChildren
  }

  return null
}

/** 递归展开子节点数组 */
function flattenChildren(arr: unknown[], result: unknown[]) {
  for (const item of arr) {
    if (item == null || item === false || item === true) continue
    if (typeof item === 'string' || typeof item === 'number') {
      result.push(String(item))
    } else if (isVNode(item)) {
      result.push(item)
    } else if (Array.isArray(item)) {
      flattenChildren(item, result)
    }
  }
}

// ============================================================
// VNode 类型守卫
// ============================================================
export function isVNode(val: unknown): val is VNode {
  return (
    typeof val === 'object' &&
    val !== null &&
    'type' in val &&
    'props' in val &&
    'key' in val
  )
}

// ============================================================
// jsx — 生产环境单/动态子节点
// ============================================================
export function jsx(
  type: string | typeof Fragment | ((props: unknown) => () => VNode),
  props: Record<string, unknown> | null,
  key?: string | null,
): VNode {
  const { normalizedProps, extractedChildren, resolvedKey, ref } = normalizeProps(props, key ?? null)
  return createVNode(type, normalizedProps, extractedChildren, resolvedKey, ref)
}

// ============================================================
// jsxs — 生产环境静态多子节点（编译优化，children 已是数组）
// ============================================================
export function jsxs(
  type: string | typeof Fragment | ((props: unknown) => () => VNode),
  props: Record<string, unknown> | null,
  key?: string | null,
): VNode {
  return jsx(type, props, key)
}

// ============================================================
// jsxDEV — 开发模式（dev mode）
// ============================================================
export function jsxDEV(
  type: string | typeof Fragment | ((props: unknown) => () => VNode),
  props: Record<string, unknown> | null,
  key?: string | null,
  _source?: { fileName: string; lineNumber: number },
  _self?: unknown,
): VNode {
  const node = jsx(type, props, key)

  // 开发环境下附加源码位置信息（便于调试）
  if (_source) {
    (node as unknown as Record<string, unknown>).__source = _source
  }

  return node
}

// ============================================================
// formatVNode — 将 VNode 格式化为可读对象（调试用）
// ============================================================
export function formatVNode(vnode: VNode): Record<string, unknown> {
  return {
    type: typeof vnode.type === 'function'
      ? vnode.type.name || '(anonymous)'
      : vnode.type === Fragment
        ? 'Fragment'
        : vnode.type,
    props: vnode.props,
    children: Array.isArray(vnode.children)
      ? vnode.children.map(c => (isVNode(c) ? formatVNode(c) : c))
      : vnode.children,
    key: vnode.key,
    ref: vnode.ref,
  }
}

// ============================================================
// 导出 Fragment 符号
// ============================================================
export { Fragment } from './types'
