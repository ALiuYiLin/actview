// ============================================================
// patch — VNode diff + 就地 DOM 更新
// 对标 Vue 的 patch 逻辑：
//   相同 type → 更新 props + 递归 patch 子节点
//   不同 type → 替换整个节点
//   文本变化 → textContent 更新
//   子节点数组 → 索引对齐递归 patch
// ============================================================
import { Fragment, type VNode, type VNodeChildren } from '@actview/jsx'
import { render } from './render'

// ============================================================
// removeNode — 递归移除 VNode 关联的 DOM
// ============================================================
function removeNode(vnode: VNodeChildren) {
  if (vnode == null || typeof vnode === 'boolean') return
  if (typeof vnode === 'string' || typeof vnode === 'number') return
  if (Array.isArray(vnode)) {
    vnode.forEach(removeNode)
    return
  }
  if (vnode.el && vnode.el.parentNode) {
    vnode.el.parentNode.removeChild(vnode.el)
  }
  vnode.el = null
}

// ============================================================
// patch — 核心 diff 算法
// ============================================================
export function patch(
  oldVNode: VNodeChildren,
  newVNode: VNodeChildren,
  parentEl: Node,
) {
  // ── 空值 ──
  if (oldVNode == null || typeof oldVNode === 'boolean') {
    if (newVNode == null || typeof newVNode === 'boolean') return
    const dom = render(newVNode)
    const nodes = Array.isArray(dom) ? dom : [dom]
    nodes.forEach(n => parentEl.appendChild(n))
    return
  }
  if (newVNode == null || typeof newVNode === 'boolean') {
    removeNode(oldVNode)
    return
  }

  // ── 文本/数字 ──
  if (
    typeof oldVNode === 'string' || typeof oldVNode === 'number' ||
    typeof newVNode === 'string' || typeof newVNode === 'number'
  ) {
    if (String(oldVNode) !== String(newVNode)) {
      replaceNode(oldVNode, newVNode, parentEl)
    }
    return
  }

  // ── 数组 ──
  if (Array.isArray(oldVNode) || Array.isArray(newVNode)) {
    patchChildrenArray(parentEl, oldVNode, newVNode)
    return
  }

  // ── VNode 对象 ──

  // type 不同 → 替换
  if (oldVNode.type !== newVNode.type) {
    replaceVNode(oldVNode, newVNode, parentEl)
    return
  }

  // type 相同 → 就地更新，转移 el 引用
  if (oldVNode.el) {
    newVNode.el = oldVNode.el
  }

  // Fragment → patch 子节点
  if (newVNode.type === Fragment) {
    patchChildrenArray(newVNode.el as Node, oldVNode.children, newVNode.children)
    return
  }

  // 组件 → 由外部 mountComponent.refresh 处理
  if (typeof newVNode.type === 'function') {
    return
  }

  // HTML 元素 → 更新 props + patch 子节点
  const el = newVNode.el as HTMLElement
  if (!el) return
  patchProps(el, oldVNode.props, newVNode.props)
  patchChildrenArray(el, oldVNode.children, newVNode.children)
}

// ============================================================
// replaceNode — 用新节点替换旧节点（通用）
// ============================================================
function replaceNode(
  oldVNode: VNodeChildren,
  newVNode: VNodeChildren,
  parentEl: Node,
) {
  const newDom = render(newVNode)
  const oldNode = vnodeToNode(oldVNode)
  if (oldNode && oldNode.parentNode) {
    oldNode.parentNode.replaceChild(newDom as Node, oldNode)
  } else {
    parentEl.appendChild(newDom as Node)
  }
}

// ============================================================
// replaceVNode — 用新 VNode 替换旧 VNode
// ============================================================
function replaceVNode(
  oldVNode: VNode,
  newVNode: VNode,
  parentEl: Node,
) {
  const newDom = render(newVNode)
  if (oldVNode.el && oldVNode.el.parentNode) {
    oldVNode.el.parentNode.replaceChild(newDom as Node, oldVNode.el)
  } else {
    parentEl.appendChild(newDom as Node)
  }
  removeNode(oldVNode)
}

// ============================================================
// vnodeToNode — 从 VNode 获取关联的 DOM 节点
// ============================================================
function vnodeToNode(vnode: VNodeChildren): Node | null {
  if (vnode == null || typeof vnode === 'boolean') return null
  if (typeof vnode === 'string' || typeof vnode === 'number') return null
  if (Array.isArray(vnode)) {
    for (const child of vnode) {
      const n = vnodeToNode(child)
      if (n) return n
    }
    return null
  }
  return vnode.el ?? null
}

// ============================================================
// patchChildrenArray — 索引对齐递归 patch 子节点数组
// ============================================================
function patchChildrenArray(
  parentEl: Node,
  oldChildren: VNodeChildren | null,
  newChildren: VNodeChildren | null,
) {
  const oldArr = childrenToArray(oldChildren)
  const newArr = childrenToArray(newChildren)
  const len = Math.max(oldArr.length, newArr.length)

  for (let i = 0; i < len; i++) {
    if (i >= oldArr.length) {
      // 新增 → mount
      const child = newArr[i]
      if (child != null && typeof child !== 'boolean') {
        const dom = render(child)
        const nodes = Array.isArray(dom) ? dom : [dom]
        nodes.forEach(n => parentEl.appendChild(n))
      }
    } else if (i >= newArr.length) {
      // 删除 → unmount
      removeNode(oldArr[i])
    } else {
      // 都存在 → diff
      const a = oldArr[i]
      const b = newArr[i]

      // 文本 ↔ 文本 → 直接更新 textContent
      if (isText(a) && isText(b)) {
        if (String(a) !== String(b)) {
          const existing = parentEl.childNodes[i]
          if (existing) existing.textContent = String(b)
        }
      } else {
        patch(a, b, parentEl)
      }
    }
  }
}

// ============================================================
// childrenToArray — 将 VNodeChildren 统一为数组
// ============================================================
function childrenToArray(children: VNodeChildren | null): VNodeChildren[] {
  if (children == null) return []
  if (Array.isArray(children)) return children
  return [children]
}

function isText(v: VNodeChildren): boolean {
  return typeof v === 'string' || typeof v === 'number'
}

// ============================================================
// patchProps — 比对并更新元素属性
// ============================================================
function patchProps(
  el: HTMLElement,
  oldProps: Record<string, unknown> | null,
  newProps: Record<string, unknown> | null,
) {
  // 移除旧 props 中不存在于新 props 的
  if (oldProps) {
    for (const key of Object.keys(oldProps)) {
      if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') continue
      if (!newProps || !(key in newProps)) {
        removeProp(el, key)
      }
    }
  }

  // 添加/更新 props
  if (newProps) {
    for (const [key, value] of Object.entries(newProps)) {
      if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') continue
      const oldVal = oldProps ? oldProps[key] : undefined
      if (oldVal !== value) {
        setProp(el, key, value)
      }
    }
  }
}

// ============================================================
// setProp — 在元素上设置属性/事件
// ============================================================
function setProp(el: HTMLElement, key: string, value: unknown) {
  if (key.startsWith('on')) {
    const eventName = key.slice(2).toLowerCase()
    el.addEventListener(eventName, value as EventListener)
  } else if (key === 'className' || key === 'class') {
    el.setAttribute('class', value as string)
  } else if (key === 'style') {
    if (typeof value === 'string') {
      el.setAttribute('style', value)
    } else if (value != null && typeof value === 'object') {
      const styles = value as Record<string, string | number>
      for (const [prop, val] of Object.entries(styles)) {
        const cssProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
        el.style.setProperty(cssProp, String(val))
      }
    }
  } else if (key === 'dangerouslySetInnerHTML') {
    el.innerHTML = (value as { __html?: string }).__html ?? ''
  } else if (key === 'htmlFor') {
    el.setAttribute('for', value as string)
  } else if (value === true) {
    el.setAttribute(key, '')
    ;(el as unknown as Record<string, unknown>)[key] = true
  } else if (value === false || value == null) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, String(value))
  }
}

// ============================================================
// removeProp — 移除元素上的属性
// ============================================================
function removeProp(el: HTMLElement, key: string) {
  if (key.startsWith('on')) {
    // 没有保存旧 handler，无法精确移除。
    // 下次 setProp 会绑新 handler，旧 handler 仍存在，
    // 但数据驱动下旧组件会被整体替换，影响有限。
  } else if (key === 'style') {
    el.removeAttribute('style')
  } else if (key === 'class' || key === 'className') {
    el.removeAttribute('class')
  } else {
    el.removeAttribute(key)
  }
}
