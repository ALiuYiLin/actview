// ============================================================
// 渲染器 — VNode → 真实 DOM
//   patch(oldVnode, newVnode, container)
//   oldVnode 为 null → 挂载；type/key 相同 → 更新；否则替换
// ============================================================

import { mountComponent } from './mountComponent'

const REACT_ELEMENT_TYPE = Symbol.for('react.element')
const Fragment = Symbol.for('react.fragment')
const Text = Symbol.for('react.text')

function createTextVNode(text: string) {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: Text,
    key: null,
    ref: null,
    props: { text },
  }
}

/** 组件 VNode：type 是 { __setup } 对象 */
export function isComponentVNode(vnode: any): boolean {
  return (
    vnode != null &&
    typeof vnode === 'object' &&
    vnode.type != null &&
    typeof vnode.type === 'object' &&
    '__setup' in vnode.type
  )
}

/** 将文本/数字子节点包装为文本 VNode，其余原样返回 */
function toVNode(child: any): any {
  if (child == null || typeof child === 'boolean') return null
  if (typeof child === 'string' || typeof child === 'number') {
    return createTextVNode(String(child))
  }
  return child
}

function normalizeChildren(children: any): any[] {
  if (children == null || children === false || children === true) return []
  return Array.isArray(children) ? children : [children]
}

// ------------------------------------------------------------
// patch 入口
// ------------------------------------------------------------

export function patch(oldVnode: any, newVnode: any, container: Element, index?: number) {
  if (oldVnode == null) {
    mountVNode(newVnode, container)
    return
  }
  if (newVnode == null) {
    unmount(oldVnode)
    return
  }
  // type 与 key 都相同 → 走更新；否则整体替换
  if (oldVnode.type === newVnode.type && oldVnode.key === newVnode.key) {
    patchVNode(oldVnode, newVnode, container, index)
  } else {
    replace(oldVnode, newVnode, container, index)
  }
}

export function render(vnode: any, container: Element) {
  patch(null, vnode, container)
}

// ------------------------------------------------------------
// 挂载
// ------------------------------------------------------------

export function mountVNode(vnode: any, container: Element | null): any {
  if (vnode == null || typeof vnode === 'boolean') return null

  // 组件
  if (isComponentVNode(vnode)) {
    mountComponent(vnode, container)
    return vnode.el
  }
  // Fragment：自身无 DOM，直接挂载 children
  if (vnode.type === Fragment) {
    vnode.el = null
    patchChildren(null, vnode.props?.children, container as Element)
    return null
  }
  // 文本
  if (vnode.type === Text) {
    const el = document.createTextNode(vnode.props.text)
    vnode.el = el
    container?.appendChild(el)
    return el
  }
  // 原生元素
  const el = document.createElement(vnode.type as string)
  vnode.el = el
  patchProps(null, vnode.props, el)
  patchChildren(null, vnode.props?.children, el)
  container?.appendChild(el)
  return el
}

// ------------------------------------------------------------
// 更新
// ------------------------------------------------------------

function patchVNode(oldVnode: any, newVnode: any, container: Element, index?: number) {
  // 组件
  if (isComponentVNode(newVnode)) {
    patchComponent(oldVnode, newVnode, container)
    return
  }
  // 文本：每次 render 生成的文本 VNode 是新的（无 el），
  // 需要按索引从 container.childNodes 恢复真实文本节点
  if (newVnode.type === Text) {
    const el = (newVnode.el =
      oldVnode.el ?? (index != null ? container.childNodes[index] : null) as Text)
    if (el && el.textContent !== newVnode.props.text) {
      el.textContent = newVnode.props.text
    }
    return
  }
  // Fragment
  if (newVnode.type === Fragment) {
    newVnode.el = oldVnode.el
    patchChildren(oldVnode.props?.children, newVnode.props?.children, container)
    return
  }
  // 原生元素：更新 props 与 children
  const el = (newVnode.el = oldVnode.el as Element)
  patchProps(oldVnode.props, newVnode.props, el)
  patchChildren(oldVnode.props?.children, newVnode.props?.children, el)
}

/** 组件更新：props 未变则复用旧实例；变了则更新 props 并手动触发
 *  子组件 update()，完成精确更新（不再整组件卸载重挂）。
 *  props 用普通对象 + 显式调度，避免响应式 track/set 引发的 effect 递归重入 */
function patchComponent(oldVnode: any, newVnode: any, container: Element) {
  const instance = oldVnode.component
  if (!instance) {
    // 异常情况：旧节点没有实例，直接重挂
    mountComponent(newVnode, container)
    return
  }

  if (!isSameProps(oldVnode.props, newVnode.props)) {
    // 增量更新 props，值有变化时手动触发子组件更新
    if (updateProps(instance.props, newVnode.props)) {
      instance.update()
    }
  }

  newVnode.component = instance
  newVnode.el = instance.subTree ? instance.subTree.el : oldVnode.el
}

/** 把新 props 增量写入旧 props，返回是否有变化 */
function updateProps(oldProps: any, newProps: any): boolean {
  newProps = newProps || {}
  let changed = false
  for (const key in newProps) {
    if (!Object.is(oldProps[key], newProps[key])) {
      oldProps[key] = newProps[key]
      changed = true
    }
  }
  // 移除父组件不再传递的 props
  for (const key in oldProps) {
    if (!(key in newProps)) {
      delete oldProps[key]
      changed = true
    }
  }
  return changed
}

function isSameProps(a: any, b: any): boolean {
  a = a || {}
  b = b || {}
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => Object.is(a[k], b[k]))
}

// ------------------------------------------------------------
// children 与 props
// ------------------------------------------------------------

function patchChildren(oldChildren: any, newChildren: any, container: Element) {
  const oldList = normalizeChildren(oldChildren).map(toVNode)
  const newList = normalizeChildren(newChildren).map(toVNode)

  // 新列表中出现 key → 走 keyed diff；否则保持同索引 diff
  if (newList.some((v) => v && v.key != null)) {
    patchKeyedChildren(oldList, newList, container)
    return
  }

  const len = Math.max(oldList.length, newList.length)
  for (let i = 0; i < len; i++) {
    patch(oldList[i] ?? null, newList[i] ?? null, container, i)
  }
}

// ------------------------------------------------------------
// keyed diff — 按 key 复用，LIS 最小移动（参考 Vue 3 思路）
//   1. 建旧 key → index 映射
//   2. 遍历新列表：key 命中 → patch 复用并记录旧 index（source，+1 偏移）；
//      未命中 → 创建（暂不挂载），source 记 0
//   3. 卸载未被复用的旧节点（此时 DOM 仍是旧顺序，文本可按索引恢复）
//   4. 对 source 求最长递增子序列（LIS）—— 这些节点保持原位，不移动
//   5. 从后往前：新节点与非 LIS 节点 insertBefore 到 anchor 前，LIS 节点不动
// ------------------------------------------------------------

function patchKeyedChildren(oldList: any[], newList: any[], container: Element) {
  const oldKeyToIndex = new Map<any, number>()
  oldList.forEach((vnode, i) => {
    if (vnode && vnode.key != null) oldKeyToIndex.set(vnode.key, i)
  })

  const newLen = newList.length
  // source[i]：新列表第 i 项对应旧列表下标 +1；0 = 新创建节点
  const source = new Array(newLen).fill(0)

  // 2. 复用或创建
  for (let i = 0; i < newLen; i++) {
    const newVNode = newList[i]
    if (newVNode == null) continue
    if (newVNode.key != null && oldKeyToIndex.has(newVNode.key)) {
      const oldIndex = oldKeyToIndex.get(newVNode.key)!
      patch(oldList[oldIndex], newVNode, container)
      source[i] = oldIndex + 1
    } else {
      // 无 key 或未命中：先创建（不挂载），最后统一插入
      mountVNode(newVNode, null)
    }
  }

  // 3. 卸载未被复用的旧节点
  oldList.forEach((oldVNode, i) => {
    if (oldVNode && !source.includes(i + 1)) {
      unmount(oldVNode, container, i)
    }
  })

  // 4. LIS：source 上求最长递增子序列（对应旧节点保持原位，不移动）
  const seq = getSequence(source)
  let j = seq.length - 1

  // 5. 从后往前插入/移动：anchor 为 i+1 项（已处理，位置正确）
  for (let i = newLen - 1; i >= 0; i--) {
    const newVNode = newList[i]
    if (newVNode == null) continue
    // Fragment 等 el 为 null 的节点静默跳过（与旧行为一致）
    if (newVNode?.el == null) continue
    const anchor = i + 1 < newLen ? newList[i + 1]?.el ?? null : null
    if (source[i] === 0) {
      // 新节点：插入到 anchor 前
      container.insertBefore(newVNode.el, anchor)
    } else if (j < 0 || i !== seq[j]) {
      // 复用节点但不在 LIS 上 → 需要移动
      container.insertBefore(newVNode.el, anchor)
    } else {
      j-- // 在 LIS 上，保持原位
    }
  }
}

// 最长递增子序列（返回下标数组；贪心 + 二分 + 前驱链回溯，值 0 表示新节点不参与）
function getSequence(arr: number[]): number[] {
  const p = arr.slice() // 前驱索引链
  const result: number[] = [] // tails：按末尾值递增的 LIS 末端下标
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i]
    if (val === 0) continue
    // 二分：找第一个末尾值 >= val 的位置
    let lo = 0
    let hi = result.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[result[mid]] < val) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) p[i] = result[lo - 1]
    result[lo] = i
  }
  // 回溯前驱链，得到真实 LIS 下标
  let len = result.length
  let k = result[len - 1]
  while (len-- > 0) {
    result[len] = k
    k = p[k]
  }
  return result
}

function patchProps(oldProps: any, newProps: any, el: Element) {
  oldProps = oldProps || {}
  newProps = newProps || {}

  // 删除旧 props 中已不存在的属性
  for (const key in oldProps) {
    if (key === 'children') continue
    if (!(key in newProps)) {
      setProp(el, key, undefined)
    }
  }
  // 设置/更新新 props
  for (const key in newProps) {
    if (key === 'children') continue
    setProp(el, key, newProps[key])
  }
}

function setProp(el: any, key: string, value: any) {
  // 事件：直接绑定到元素属性（onchange → el.onchange）
  if (key.startsWith('on')) {
    el[key] = typeof value === 'function' ? value : null
    return
  }
  // class / style / value / checked 走 property
  if (key === 'class' || key === 'className') {
    el.className = value ?? ''
    return
  }
  if (key === 'style') {
    if (typeof value === 'string') el.style.cssText = value
    else if (value) Object.assign(el.style, value)
    else el.removeAttribute('style')
    return
  }
  if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'readonly') {
    if (value == null || value === false) {
      el.removeAttribute(key)
    } else if (key === 'value') {
      // 受控 input：赋值可能重置光标到末尾，更新前后记录并恢复
      setInputValue(el, value)
    } else {
      el[key] = value
    }
    return
  }
  // 其余走 attribute
  if (value == null || value === false) {
    el.removeAttribute(key)
  } else if (value === true) {
    el.setAttribute(key, '')
  } else {
    el.setAttribute(key, String(value))
  }
}

/**
 * 受控 input 赋值：浏览器对 value 赋值会把光标移到末尾，
 * 赋值前记录 selectionStart/End，赋值后恢复（截断到新值长度内）。
 * 仅当元素聚焦且值确实变化时处理，避免无谓操作。
 */
function setInputValue(el: any, value: any) {
  const str = String(value)
  if (el.value === str) return

  const active =
    typeof document !== 'undefined' && document.activeElement === el
  const start = active ? el.selectionStart : null
  const end = active ? el.selectionEnd : null

  el.value = str

  if (active && typeof start === 'number' && typeof el.selectionStart === 'number') {
    el.selectionStart = Math.min(start, str.length)
    el.selectionEnd = Math.min(end ?? start, str.length)
  }
}

// ------------------------------------------------------------
// 替换与卸载
// ------------------------------------------------------------

function replace(oldVnode: any, newVnode: any, container: Element, index?: number) {
  const newEl = mountVNode(newVnode, null)
  // 文本旧节点无 el，同样按索引从 childNodes 恢复
  const oldEl = oldVnode.el ?? (index != null ? container.childNodes[index] : null)
  const parent = oldEl?.parentNode
  if (parent && newEl) {
    parent.replaceChild(newEl, oldEl)
  }
}

export function unmount(vnode: any, container?: Element, index?: number) {
  if (vnode == null) return
  // 组件：先停止其更新 effect，防止响应式变化操作已移除的 DOM
  if (isComponentVNode(vnode)) {
    vnode.component?.unmount?.()
  }
  // 文本旧节点无持久 el（每次 render 重建），按索引从 childNodes 恢复
  const el = vnode.el ?? (container && index != null ? container.childNodes[index] : null)
  if (el && el.parentNode) {
    el.parentNode.removeChild(el)
  }
}
