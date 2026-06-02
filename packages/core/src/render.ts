// ============================================================
// VNode → 真实 DOM 的渲染器
// ============================================================
import { Fragment, type VNodeChildren } from '@actview/jsx'
import { mountComponent } from './component'

// ============================================================
// render：将 VNode 递归转换为真实 DOM 节点
// ============================================================
export function render(vnode: VNodeChildren): Node | Node[] {

  // 文本节点
  if (typeof vnode === 'string') {
    return document.createTextNode(vnode)
  }
  if (typeof vnode === 'number') {
    return document.createTextNode(String(vnode))
  }

  // null / undefined / boolean → 空文本
  if (vnode == null || typeof vnode === 'boolean') {
    return document.createTextNode('')
  }

  // 数组 → 递归渲染每一项
  if (Array.isArray(vnode)) {
    const nodes: Node[] = []
    for (const child of vnode) {
      const result = render(child)
      if (Array.isArray(result)) {
        nodes.push(...result)
      } else {
        nodes.push(result)
      }
    }
    return nodes
  }

  // ── 至此一定是 VNode 对象 ──

  // Fragment → 渲染子节点（无包裹元素）
  if (vnode.type === Fragment) {
    if (vnode.children == null) return document.createTextNode('')
    return render(vnode.children)
  }

  // 组件 → 代理到 mountComponent
  if (typeof vnode.type === 'function') {
    const componentFn = vnode.type as (props: Record<string, unknown>) => () => VNodeChildren
    const props = (vnode.props ?? {}) as Record<string, unknown>

    // anchor 作为占位，父级通过 anchor 定位插入位置
    const anchor = document.createComment('')
    let currentNodes: Node[] = []

    mountComponent(componentFn, anchor.parentNode ?? document.createDocumentFragment(), {
      update: (nodes, _container) => {
        // 移除旧节点
        currentNodes.forEach(n => n.parentNode?.removeChild(n))
        currentNodes = []

        // 挂载新节点到 anchor 后面
        const parent = anchor.parentNode
        if (parent) {
          nodes.forEach(n => parent.insertBefore(n, anchor.nextSibling))
        }
        currentNodes = nodes
      },
    }, props)

    return [anchor, ...currentNodes]
  }

  // ── 普通 HTML 标签 ──
  const el = document.createElement(vnode.type as string)

  // 挂载 props / 事件 / 属性
  if (vnode.props) {
    applyProps(el, vnode.props)
  }

  // 渲染子节点并挂载
  if (vnode.children != null) {
    const children = Array.isArray(vnode.children)
      ? vnode.children
      : [vnode.children]

    for (const child of children) {
      const childNode = render(child)
      if (Array.isArray(childNode)) {
        for (const n of childNode) el.appendChild(n)
      } else {
        el.appendChild(childNode)
      }
    }
  }

  // 将 DOM 引用回写 VNode（便于后续 diff）
  vnode.el = el

  return el
}

// ============================================================
// 将 props 应用到 DOM 元素
// ============================================================
export function applyProps(el: HTMLElement, props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    // 跳过内部属性
    if (key === 'children' || key === 'key' || key === 'ref' || key === '__source') {
      continue
    }

    if (key.startsWith('on')) {
      mountEvent(el, key, value as EventListener)
    } else if (key === 'className') {
      el.setAttribute('class', value as string)
    } else if (key === 'class') {
      el.setAttribute('class', value as string)
    } else if (key === 'style') {
      if (typeof value === 'string') {
        el.setAttribute('style', value)
      } else if (value != null && typeof value === 'object') {
        // 对象样式：{ color: 'red', fontSize: '14px' }
        const styles = value as Record<string, string | number>
        for (const [prop, val] of Object.entries(styles)) {
          // camelCase → kebab-case
          const cssProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
          el.style.setProperty(cssProp, String(val))
        }
      }
    } else if (key === 'dangerouslySetInnerHTML') {
      const html = (value as { __html?: string }).__html ?? ''
      el.innerHTML = html
    } else if (key === 'htmlFor') {
      el.setAttribute('for', value as string)
    } else if (value === true) {
      // boolean 属性：disabled、hidden 等
      el.setAttribute(key, '')
      ;(el as unknown as Record<string, unknown>)[key] = true
    } else if (value === false || value == null) {
      // false / null → 跳过（保留默认行为）
      continue
    } else if (typeof value === 'number' || typeof value === 'string') {
      el.setAttribute(key, String(value))
    } else {
      // 兜底：尝试 setAttribute
      el.setAttribute(key, String(value))
    }
  }
}

// ============================================================
// mountEvent — invoker 模式绑定事件
// 首次绑一个固定的包装函数 invoker 到 DOM，
// 后续更新只改 invoker.value 引用，不碰 DOM。
// ============================================================
export function mountEvent(el: HTMLElement, key: string, handler: EventListener) {
  const elAny = el as unknown as Record<string, unknown>
  let invokers = elAny._inv as Record<string, Function> | undefined
  if (!invokers) {
    invokers = {}
    elAny._inv = invokers
  }

  let invoker = invokers[key] as undefined | (EventListener & { value: EventListener })

  if (!invoker) {
    invoker = ((e: Event) => invoker!.value(e)) as EventListener & { value: EventListener }
    invoker.value = handler
    ;(invokers as Record<string, unknown>)[key] = invoker
    el.addEventListener(key.slice(2).toLowerCase(), invoker)
  } else {
    invoker.value = handler
  }
}
