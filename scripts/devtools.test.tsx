// ============================================================
// @actview/devtools 验收测试（vitest + happy-dom）
//   覆盖：组件树收集（挂载/卸载父子关系）、事件流、window hook 暴露、
//         subscribe / reset
// 运行：pnpm test
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { reactive, createApp, nextTick } from 'actview'
import { initDevTools, type DevtoolsGlobalHook } from '@actview/devtools'

function hook(): DevtoolsGlobalHook {
  return (window as any).__ACTVIEW_DEVTOOLS_GLOBAL_HOOK__
}

function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'devtools-host'
  document.body.appendChild(host)
  createApp(component).mount('#devtools-host')
  return host
}

describe('@actview/devtools', () => {
  beforeEach(() => {
    initDevTools()
    hook()?.reset()
  })

  it('initDevTools 暴露 window hook', () => {
    initDevTools()
    expect(hook()).toBeDefined()
    expect(typeof hook().getComponentTree).toBe('function')
  })

  it('挂载组件收集组件树（含父子关系）', () => {
    function Child() {
      return <div class="child">child</div>
    }
    function Parent() {
      return (
        <div class="parent">
          <Child />
        </div>
      )
    }
    mount(Parent)
    const tree = hook().getComponentTree()
    const names = tree.map((n) => n.name)
    expect(names).toContain('Parent')
    expect(names).toContain('Child')
    // 父子关系：Child 的 parentId 指向 Parent
    const parent = tree.find((n) => n.name === 'Parent')!
    const child = tree.find((n) => n.name === 'Child')!
    expect(child.parentId).toBe(parent.id)
    expect(parent.children).toContain(child.id)
  })

  it('事件流记录 mount 与 trigger', async () => {
    const state = reactive({ n: 0 })
    function App() {
      return <div>{state.n}</div>
    }
    mount(App)
    state.n = 1
    await nextTick()

    const events = hook().getEventLog()
    expect(events.some((e) => e.type === 'mount')).toBe(true)
    expect(events.some((e) => e.type === 'trigger' && e.key === 'n')).toBe(true)
  })

  it('卸载组件从组件树移除', async () => {
    const state = reactive({ show: true })
    function Child() {
      return <div class="child">child</div>
    }
    function App() {
      return state.show ? <Child /> : null
    }
    mount(App)
    expect(hook().getComponentTree().some((n) => n.name === 'Child')).toBe(true)

    state.show = false
    await nextTick()
    expect(hook().getComponentTree().some((n) => n.name === 'Child')).toBe(false)
  })

  it('subscribe 订阅快照变化', () => {
    let snapshots = 0
    const unsub = hook().subscribe(() => snapshots++)
    function App() {
      return <div>hi</div>
    }
    mount(App) // 触发 mount → notify → subscribe 回调
    expect(snapshots).toBeGreaterThan(0)
    unsub()
  })

  it('reset 清空组件树与事件流', () => {
    function App() {
      return <div>hi</div>
    }
    mount(App)
    hook().reset()
    expect(hook().getComponentTree()).toEqual([])
    expect(hook().getEventLog()).toEqual([])
  })
})
