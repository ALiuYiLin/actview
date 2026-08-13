// ============================================================
// @actview/devtools — 运行时调试后端（backend）
//   initDevTools()：注册 core 埋点 hook，收集组件树与响应式事件流，
//   暴露 window.__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__ 供调试面板 / 浏览器扩展接入。
//
//   数据：
//   - 组件树：挂载/卸载维护父子关系（id/name/parentId/children）
//   - 事件流：mount/update/unmount/track/trigger（限长环形）
// ============================================================

import { setDevtoolsHook } from '@actview/core'
import type { DevtoolsHook } from '@actview/core'

export interface TreeNode {
  id: number
  name: string
  parentId: number | null
  children: number[]
}

export interface EventEntry {
  type: 'mount' | 'update' | 'unmount' | 'track' | 'trigger'
  time: number
  id?: number
  name?: string
  key?: string
}

export interface DevtoolsSnapshot {
  tree: TreeNode[]
  events: EventEntry[]
}

const tree = new Map<number, TreeNode>()
const events: EventEntry[] = []
const listeners = new Set<(snapshot: DevtoolsSnapshot) => void>()

let initialized = false

const MAX_EVENTS = 1000

function pushEvent(e: Omit<EventEntry, 'time'>) {
  events.push({ time: Date.now(), ...e })
  if (events.length > MAX_EVENTS) events.shift()
}

function snapshot(): DevtoolsSnapshot {
  return { tree: Array.from(tree.values()), events: events.slice() }
}

function notify() {
  const snap = snapshot()
  listeners.forEach((cb) => cb(snap))
}

export interface DevtoolsGlobalHook {
  getComponentTree: () => TreeNode[]
  getEventLog: () => EventEntry[]
  subscribe: (cb: (snapshot: DevtoolsSnapshot) => void) => () => void
  reset: () => void
}

/** 启动 DevTools：注册埋点 + 暴露 window hook（幂等） */
export function initDevTools(): void {
  if (initialized) return
  initialized = true

  const hook: DevtoolsHook = {
    onComponentMount(info) {
      const node: TreeNode = {
        id: info.id,
        name: info.name,
        parentId: info.parent?.id ?? null,
        children: []
      }
      tree.set(info.id, node)
      if (node.parentId != null && tree.has(node.parentId)) {
        tree.get(node.parentId)!.children.push(info.id)
      }
      // 回填：子组件先于父组件挂载（挂载顺序），父节点创建后补 children
      for (const other of tree.values()) {
        if (other.parentId === info.id && !node.children.includes(other.id)) {
          node.children.push(other.id)
        }
      }
      pushEvent({ type: 'mount', id: info.id, name: info.name })
      notify()
    },
    onComponentUpdate(info) {
      pushEvent({ type: 'update', id: info.id, name: info.name })
      notify()
    },
    onComponentUnmount(info) {
      tree.delete(info.id)
      const parentId = info.parent?.id
      if (parentId != null && tree.has(parentId)) {
        const p = tree.get(parentId)!
        const i = p.children.indexOf(info.id)
        if (i >= 0) p.children.splice(i, 1)
      }
      pushEvent({ type: 'unmount', id: info.id, name: info.name })
      notify()
    },
    onTrack(e) {
      pushEvent({ type: 'track', key: String(e.key) })
    },
    onTrigger(e) {
      pushEvent({ type: 'trigger', key: String(e.key) })
    }
  }

  setDevtoolsHook(hook)

  const api: DevtoolsGlobalHook = {
    getComponentTree: () => Array.from(tree.values()),
    getEventLog: () => events.slice(),
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    reset() {
      tree.clear()
      events.length = 0
      notify()
    }
  }

  if (typeof window !== 'undefined') {
    ;(window as any).__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__ = api
  }
}

// ------------------------------------------------------------
// 调试面板浮层（最小可用：组件树 + 事件流，纯 DOM）
// ------------------------------------------------------------

/** 计算节点深度（根 = 0） */
function computeDepth(tree: TreeNode[]): Map<number, number> {
  const byId = new Map(tree.map((n) => [n.id, n]))
  const depth = new Map<number, number>()
  const walk = (id: number): number => {
    if (depth.has(id)) return depth.get(id)!
    const node = byId.get(id)
    const d = node && node.parentId != null ? walk(node.parentId) + 1 : 0
    depth.set(id, d)
    return d
  }
  tree.forEach((n) => walk(n.id))
  return depth
}

/** 在应用页面挂载调试面板浮层，返回卸载函数 */
export function mountPanel(container?: HTMLElement): () => void {
  const host = container ?? document.createElement('div')
  const autoCreated = !container
  if (autoCreated) {
    host.style.cssText =
      'position:fixed;right:0;top:0;bottom:0;width:320px;' +
      'background:#1e1e1e;color:#eee;font:12px/1.5 monospace;' +
      'overflow:auto;z-index:99999;padding:10px;white-space:pre;'
    document.body.appendChild(host)
  }

  const render = (snap: DevtoolsSnapshot) => {
    const depth = computeDepth(snap.tree)
    const treeText = snap.tree
      .map((n) => `${'  '.repeat(depth.get(n.id) ?? 0)}${n.name} (#${n.id})`)
      .join('\n')
    const eventText = snap.events
      .slice(-20)
      .map((e) => `[${e.type}] ${e.name ?? ''}${e.key ? ' ' + e.key : ''}`)
      .join('\n')
    host.textContent = `=== 组件树 ===\n${treeText}\n\n=== 事件流（最近 20）===\n${eventText}`
  }

  const api = (window as any).__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__ as
    | DevtoolsGlobalHook
    | undefined
  if (!api) {
    host.textContent = '[devtools] 请先调用 initDevTools()'
    return () => {
      if (autoCreated) host.remove()
    }
  }
  const unsub = api.subscribe(render)
  render({ tree: api.getComponentTree(), events: api.getEventLog() })
  return () => {
    unsub()
    if (autoCreated) host.remove()
  }
}
