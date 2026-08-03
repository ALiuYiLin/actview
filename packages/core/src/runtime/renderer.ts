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
// keyed diff — 按 key 复用/移动/删除节点
//   1. 建旧 key → index 映射
//   2. 遍历新列表：key 命中 → patch 复用；否则新建（先不挂载）
//   3. 卸载未被复用的旧节点（此时 DOM 仍是旧顺序，文本可按索引恢复）
//   4. 按新顺序依次 appendChild 重排（已挂载节点会被移动）
// ------------------------------------------------------------

function patchKeyedChildren(oldList: any[], newList: any[], container: Element) {
  const oldKeyToIndex = new Map<any, number>()
  oldList.forEach((vnode, i) => {
    if (vnode && vnode.key != null) oldKeyToIndex.set(vnode.key, i)
  })

  const reusedIndexes = new Set<number>()

  // 2. 复用或创建
  for (const newVNode of newList) {
    if (newVNode == null) continue
    if (newVNode.key != null && oldKeyToIndex.has(newVNode.key)) {
      const oldIndex = oldKeyToIndex.get(newVNode.key)!
      patch(oldList[oldIndex], newVNode, container)
      reusedIndexes.add(oldIndex)
    } else {
      // 无 key 或未命中：先创建（不挂载），重排时统一插入
      mountVNode(newVNode, null)
    }
  }

  // 3. 卸载未复用的旧节点
  oldList.forEach((oldVNode, i) => {
    if (oldVNode && !reusedIndexes.has(i)) {
      unmount(oldVNode, container, i)
    }
  })

  // 4. 按新顺序重排：依次 append（appendChild 对已挂载节点是移动）
  for (const newVNode of newList) {
    if (newVNode?.el) container.appendChild(newVNode.el)
  }
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
