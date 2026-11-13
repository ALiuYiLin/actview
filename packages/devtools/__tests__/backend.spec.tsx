// ============================================================
// @actview/devtools backend：树 / 状态 / 事件 / 订阅 / 性能
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Computed,
  Model,
  Prop,
  Ref,
  UseModel,
  createApp,
  nextTick,
} from '@actview/core'
import {
  devtoolsPlugin,
  getDevtoolsBackend,
  resetDevtoolsBackend,
  type DevtoolsSnapshot,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  resetDevtoolsBackend()
  document.body.innerHTML = ''
})

describe('@actview/devtools：backend', () => {
  it('维护 app / component 树，读取 props / state / computed / Model', async () => {
    @Model
    class CounterModel {
      @Ref
      count = 0

      @Computed
      get double(): number {
        return this.count * 2
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @Prop
      label = ''

      @Ref
      local = 1

      @UseModel(CounterModel)
      model!: CounterModel

      render() {
        return (
          <span>
            {this.label}/{this.local}/{this.model.double}
          </span>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      count = 0

      render() {
        return (
          <div>
            <Child label={`n=${this.count}`} />
          </div>
        )
      }
    }

    const backend = getDevtoolsBackend()
    const snapshots: DevtoolsSnapshot[] = []
    const unsubscribe = backend.subscribe((snapshot) => {
      snapshots.push(snapshot)
    })

    const root = mountRoot()
    const app = createApp(App)
    app.config.performance = true
    app.use(devtoolsPlugin, { appName: 'Demo' })
    const appInstance = app.mount(root) as unknown as App
    await nextTick()

    const snapshot = backend.getSnapshot()
    expect(snapshot.apps).toHaveLength(1)
    expect(snapshot.apps[0].name).toBe('Demo')
    expect(snapshot.components.map((c) => c.name).sort()).toEqual([
      'App',
      'Child',
    ])

    const appRecord = snapshot.components.find((c) => c.name === 'App')!
    const childRecord = snapshot.components.find((c) => c.name === 'Child')!
    expect(childRecord.parentId).toBe(appRecord.id)
    expect(appRecord.childIds).toContain(childRecord.id)

    const childState = backend.getComponentState(childRecord.id)!
    expect(childState.props.label).toBe('n=0')
    expect(childState.state.local).toBe(1)
    expect(childState.computed).toEqual({})
    expect(childState.models[0].token).toBe('CounterModel')
    expect(childState.models[0].state.count).toBe(0)
    expect(childState.models[0].computed.double).toBe(0)

    // 更新 App @Ref：触发 render，renderCount / 事件增加
    appInstance.count = 1
    await nextTick()
    const after = backend.getSnapshot()
    const updatedApp = after.components.find((c) => c.id === appRecord.id)!
    expect(updatedApp.renderCount).toBeGreaterThan(1)
    expect(after.events.some((e) => e.type === 'trigger')).toBe(true)
    expect(after.events.some((e) => e.type === 'track')).toBe(true)
    expect(after.performance.length).toBeGreaterThan(0)
    expect(snapshots.length).toBeGreaterThan(1)

    unsubscribe()
    app.unmount()
    await nextTick()
    expect(backend.getSnapshot().apps).toHaveLength(0)
    expect(backend.getSnapshot().components).toHaveLength(0)
  })

  it('config.devtools=false 时不安装 hook', () => {
    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <span>app</span>
      }
    }

    const app = createApp(App)
    app.config.devtools = false
    app.use(devtoolsPlugin)
    app.mount(mountRoot())

    // 插件跳过后，backend 不应收集到 app。
    expect(getDevtoolsBackend().getSnapshot().apps).toHaveLength(0)
  })
})
