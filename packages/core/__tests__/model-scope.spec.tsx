// ============================================================
// Model Scope：inherited / Named / app
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Inject,
  Model,
  Mounted,
  Named,
  Ref,
  Scope,
  Setup,
  Unmounted,
  UseModel,
  createApp,
  nextTick,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@actview/core：Model Scope', () => {
  it('inherited：父子共享实例，生命周期只归创建者', async () => {
    const log: string[] = []

    @Model
    @Scope('inherited')
    class SharedData {
      @Ref
      value = 0

      @Setup
      setup(): void {
        log.push('setup')
      }

      @Mounted
      mounted(): void {
        log.push('mounted')
      }

      @Unmounted
      unmounted(): void {
        log.push('unmounted')
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @UseModel(SharedData)
      data!: SharedData

      render() {
        return <span>child:{this.data.value}</span>
      }
    }

    @Component({ name: 'Parent' })
    class Parent extends ActViewComponent {
      @Ref
      showChild = true

      @UseModel(SharedData)
      data!: SharedData

      render() {
        return (
          <div>
            <span>parent:{this.data.value}</span>
            {this.showChild ? <Child /> : null}
          </div>
        )
      }
    }

    const root = mountRoot()
    const app = createApp(Parent)
    const parent = app.mount(root) as unknown as Parent
    await nextTick()

    expect(log).toEqual(['setup', 'mounted'])
    expect(root.textContent).toContain('parent:0')
    expect(root.textContent).toContain('child:0')

    parent.data.value = 5
    await nextTick()
    expect(root.textContent).toContain('parent:5')
    expect(root.textContent).toContain('child:5')

    parent.showChild = false
    await nextTick()
    expect(log).toEqual(['setup', 'mounted'])

    app.unmount()
    await nextTick()
    expect(log).toEqual(['setup', 'mounted', 'unmounted'])
  })

  it('Named：同一 scope / token 下多实例', async () => {
    @Model
    @Named('primary')
    class EditorData {
      @Ref
      text = ''
    }

    @Component({ name: 'Editor' })
    class Editor extends ActViewComponent {
      @UseModel(EditorData)
      primary!: EditorData

      @UseModel(EditorData, { name: 'secondary' })
      secondary!: EditorData

      render() {
        return (
          <span>
            {this.primary.text}/{this.secondary.text}
          </span>
        )
      }
    }

    const root = mountRoot()
    const app = createApp(Editor)
    const instance = app.mount(root) as unknown as Editor
    await nextTick()

    instance.primary.text = 'a'
    instance.secondary.text = 'b'
    await nextTick()

    expect(instance.primary).not.toBe(instance.secondary)
    expect(root.textContent).toBe('a/b')
  })

  it('app：每个 App 一份；setup / mounted / unmounted 跟 App 生命周期', async () => {
    const log: string[] = []

    @Model
    @Scope('app')
    class SessionData {
      @Ref
      token = 'guest'

      @Setup
      setup(): void {
        log.push('setup')
      }

      @Mounted
      mounted(): void {
        log.push('mounted')
      }

      @Unmounted
      unmounted(): void {
        log.push('unmounted')
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @UseModel(SessionData)
      session!: SessionData

      render() {
        return <span>child:{this.session.token}</span>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @UseModel(SessionData)
      session!: SessionData

      render() {
        return (
          <div>
            <span>app:{this.session.token}</span>
            <Child />
          </div>
        )
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await nextTick()

    expect(log).toEqual(['setup', 'mounted'])
    expect(root.textContent).toContain('app:guest')
    expect(root.textContent).toContain('child:guest')

    instance.session.token = 'member'
    await nextTick()
    expect(root.textContent).toContain('app:member')
    expect(root.textContent).toContain('child:member')

    app.unmount()
    await nextTick()
    expect(log).toEqual(['setup', 'mounted', 'unmounted'])
  })

  it('app：@Inject 读取 app.provide', async () => {
    @Model
    @Scope('app')
    class ConfigData {
      @Inject('config')
      config!: string

      @Ref
      value = ''

      @Setup
      setup(): void {
        this.value = this.config
      }
    }

    @Component({ name: 'ConfigApp' })
    class ConfigApp extends ActViewComponent {
      @UseModel(ConfigData)
      data!: ConfigData

      render() {
        return <span>{this.data.value}</span>
      }
    }

    const root = mountRoot()
    const app = createApp(ConfigApp)
    app.provide('config', 'from-app')
    app.mount(root)
    await nextTick()
    expect(root.textContent).toBe('from-app')
  })
})
