// ============================================================
// mount.ts — 组件挂载与 VNode diff/patch
// 所有流程统一走 patch：
//   patch(null, vnode, parent)  → 创建
//   patch(old, new, parent)      → 更新
//   组件函数 → 递归 mount
// ============================================================
import { isValidElement, Fragment, type VNodeChildren } from '@local/jsx-factory'
import { runEffect } from './reactive-system'
import type { ActViewComponent } from '../types'

// ============================================================
// mountComponent — 将组件挂载到容器
//   component: (props) => () => LazyVNode
// ============================================================
export function mountComponent(
  component: ActViewComponent,
  container: HTMLElement,
) {
  const render = component({})
  let oldVNode: any = null

  runEffect(() => {
    const newVNode = render()
    patch(oldVNode, newVNode, container)
    oldVNode = newVNode
    console.log('oldVNode: ', oldVNode);
  })
}

// ============================================================
// patch — 核心 diff 算法
// ============================================================
export function patch(
  oldVNode: VNodeChildren | null,
  newVNode: VNodeChildren,
  parentEl: Node,
) {
  // ── 新增（old == null）→ 直接创建 DOM ──
  if (oldVNode == null || typeof oldVNode === 'boolean') {
    if (newVNode == null || typeof newVNode === 'boolean') return
    const nodes = createDOM(newVNode)
    nodes.forEach(n => { if (n) parentEl.appendChild(n) })
    return
  }

  // ── 删除（new == null）→ 移除 DOM ──
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
      const existing = getEl(oldVNode)
      if (existing) existing.textContent = String(newVNode)
    }
    return
  }

  // ── 数组 ──
  if (Array.isArray(oldVNode) || Array.isArray(newVNode)) {
    patchChildren(parentEl, oldVNode, newVNode)
    return
  }

  // ── 对象 VNode ──
  if (oldVNode.type !== newVNode.type) {
    // type 不同 → 整体替换
    replaceVNode(oldVNode, newVNode, parentEl)
    return
  }

  // type 相同 → 复用 DOM 引用
  if (oldVNode.el) newVNode.el = oldVNode.el

  // Fragment → patch 子节点
  if (newVNode.type === Fragment) {
    patchChildren(parentEl, oldVNode.props?.children, newVNode.props?.children)
    return
  }

  // 组件 → 跳过（由内部 mountComponent 的 runEffect 处理）
  if (typeof newVNode.type === 'function') return

  // HTML 元素 → 更新 props + patch 子节点
  const el = newVNode.el as HTMLElement
  if (!el) return
  patchProps(el, oldVNode.props, newVNode.props)
  patchChildren(el, oldVNode.props?.children, newVNode.props?.children)
}

// ============================================================
// createDOM — 将 VNode 转为真实 DOM，返回 Node 数组
// 只在首次挂载（patch null）时调用
// ============================================================
function createDOM(vnode: any): Node[] {
  // 空值
  if (vnode == null || typeof vnode === 'boolean') return [document.createTextNode('')]

  // 文本/数值
  if (typeof vnode === 'string') return [document.createTextNode(vnode)]
  if (typeof vnode === 'number') return [document.createTextNode(String(vnode))]

  // 数组 → 递归
  if (Array.isArray(vnode)) {
    const result: Node[] = []
    for (const child of vnode) result.push(...createDOM(child))
    return result
  }

  // 必须是有效元素
  if (!isValidElement(vnode)) return [document.createTextNode('')]

  // Fragment → 渲染子节点
  if (vnode.type === Fragment) {
    return createDOM(vnode.props?.children)
  }

  // 组件 → 递归挂载（首次）
  if (typeof vnode.type === 'function') {
    const componentFn = vnode.type
    const props = vnode.props ?? {}
    const anchor = document.createComment('c')
    const frag = document.createDocumentFragment()
    frag.appendChild(anchor)

    const renderFn = componentFn(props)
    let oldCompVNode: any = null

    runEffect(() => {
      const newCompVNode = renderFn()
      patch(oldCompVNode, newCompVNode, frag)
      oldCompVNode = newCompVNode
    })

    return Array.from(frag.childNodes)
  }

  // HTML 元素
  const el = document.createElement(vnode.type as string)
  if (vnode.props) applyProps(el, vnode.props)

  const children = vnode.props?.children
  if (children != null) {
    const childList = Array.isArray(children) ? children : [children]
    for (const child of childList) {
      createDOM(child).forEach(n => el.appendChild(n))
    }
  }

  vnode.el = el
  return [el]
}

// ============================================================
// 辅助函数
// ============================================================

function removeNode(vnode: any) {
  if (vnode == null || typeof vnode === 'boolean') return
  if (typeof vnode === 'string' || typeof vnode === 'number') return
  if (Array.isArray(vnode)) { vnode.forEach(removeNode); return }
  if (vnode.el && vnode.el.parentNode) vnode.el.parentNode.removeChild(vnode.el)
  vnode.el = null
}

function replaceVNode(oldVNode: any, newVNode: any, parentEl: Node) {
  const newNodes = createDOM(newVNode)
  const oldNode = oldVNode.el
  if (oldNode && oldNode.parentNode) {
    newNodes.forEach(n => oldNode.parentNode!.insertBefore(n, oldNode.nextSibling))
    oldNode.parentNode.removeChild(oldNode)
  } else {
    newNodes.forEach(n => parentEl.appendChild(n))
  }
  removeNode(oldVNode)
}

function patchChildren(parentEl: Node, oldChildren: any, newChildren: any) {
  const oldArr = toArray(oldChildren)
  const newArr = toArray(newChildren)
  const len = Math.max(oldArr.length, newArr.length)

  for (let i = 0; i < len; i++) {
    if (i >= oldArr.length) {
      // 新增
      const child = newArr[i]
      if (child != null && typeof child !== 'boolean') {
        createDOM(child).forEach(n => parentEl.appendChild(n))
      }
    } else if (i >= newArr.length) {
      // 删除
      removeNode(oldArr[i])
    } else {
      // diff
      const a = oldArr[i]; const b = newArr[i]
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

function toArray(children: any): any[] {
  if (children == null) return []
  if (Array.isArray(children)) return children
  return [children]
}

function isText(v: any) { return typeof v === 'string' || typeof v === 'number' }

function getEl(vnode: any): Node | null {
  if (vnode == null || typeof vnode === 'boolean') return null
  if (typeof vnode === 'string' || typeof vnode === 'number') return null
  if (Array.isArray(vnode)) { for (const c of vnode) { const n = getEl(c); if (n) return n }; return null }
  return vnode.el ?? null
}

// ============================================================
// 属性/事件处理
// ============================================================

function applyProps(el: HTMLElement, props: Record<string, any>) {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') continue
    if (key.startsWith('on')) { mountEvent(el, key, value); continue }
    if (key === 'class' || key === 'className') { el.setAttribute('class', value); continue }
    if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value)
      else if (value && typeof value === 'object')
        for (const [p, v] of Object.entries(value))
          el.style.setProperty(p.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), String(v))
      continue
    }
    if (value === true) { el.setAttribute(key, ''); (el as any)[key] = true; continue }
    if (value === false || value == null) continue
    el.setAttribute(key, String(value))
  }
}

function patchProps(el: HTMLElement, oldProps: any, newProps: any) {
  if (oldProps) for (const key of Object.keys(oldProps)) {
    if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') continue
    if (!newProps || !(key in newProps)) removeProp(el, key)
  }
  if (newProps) for (const [key, value] of Object.entries(newProps)) {
    if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') continue
    if (oldProps?.[key] !== value) setProp(el, key, value)
  }
}

function setProp(el: HTMLElement, key: string, value: any) {
  if (key.startsWith('on')) { mountEvent(el, key, value); return }
  if (key === 'class' || key === 'className') { el.setAttribute('class', value); return }
  if (key === 'style') {
    if (typeof value === 'string') el.setAttribute('style', value)
    else if (value && typeof value === 'object')
      for (const [p, v] of Object.entries(value))
        el.style.setProperty(p.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), String(v))
    return
  }
  if (value === true) { el.setAttribute(key, ''); (el as any)[key] = true; return }
  if (value === false || value == null) { el.removeAttribute(key); return }
  el.setAttribute(key, String(value))
}

function removeProp(el: HTMLElement, key: string) {
  if (!key.startsWith('on')) {
    if (key === 'style' || key === 'class' || key === 'className')
      el.removeAttribute(key === 'className' ? 'class' : key)
    else el.removeAttribute(key)
  }
}

function mountEvent(el: HTMLElement, key: string, handler: EventListener) {
  const elAny = el as any
  let invokers = elAny._inv || (elAny._inv = {})
  let invoker = invokers[key]
  if (!invoker) {
    invoker = ((e: Event) => invoker!.value(e)) as any
    invoker.value = handler
    invokers[key] = invoker
    el.addEventListener(key.slice(2).toLowerCase(), invoker)
  } else {
    invoker.value = handler
  }
}
