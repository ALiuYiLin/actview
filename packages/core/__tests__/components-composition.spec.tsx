// ============================================================
// 组合约定（不引入 slots / defineExpose）：
//   - 组件通过 @Prop 传组件构造器或 render function；
//   - 组件 ref 使用显式 ref callback，父组件持有类实例；
//   - 公开 API 用 TypeScript interface 约束（不使用 defineExpose）。
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Mounted,
  Prop,
  Ref,
  Unmounted,
  createApp,
  nextTick,
  type ClassComponent,
  type ElementChild,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@actview/core：Props 组合与组件 ref', () => {
  it('组件构造器作为 prop：子组件在 render 中挂载', async () => {
    interface SideBarProps {
      active: boolean
    }

    @Component({ name: 'SideBar' })
    class SideBar extends ActViewComponent<SideBarProps> {
      @Prop
      active = false

      render() {
        return <span>{this.active ? 'active' : 'idle'}</span>
      }
    }

    @Component({ name: 'Layout' })
    class Layout extends ActViewComponent {
      @Prop
      SideBarItem!: ClassComponent<SideBarProps>

      @Prop
      active = false

      render() {
        const SideBarItem = this.SideBarItem
        return (
          <div>
            <SideBarItem active={this.active} />
          </div>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      active = true

      render() {
        return <Layout SideBarItem={SideBar} active={this.active} />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(root.textContent).toBe('active')
  })

  it('render function 作为 prop：作用域内容不需要 slot', async () => {
    @Component({ name: 'List' })
    class List extends ActViewComponent {
      @Prop
      renderItem!: (item: string) => ElementChild

      render() {
        return <div>{this.renderItem('hello')}</div>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <List
            renderItem={(item: string) => (
              <strong>
                {item}-{1 + 1}
              </strong>
            )}
          />
        )
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(root.querySelector('strong')?.textContent).toBe('hello-2')
  })

  it('组件 ref：父组件通过显式 ref callback 访问子类实例', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @Ref
      count = 0

      openCount = 0

      open(): void {
        this.openCount++
        this.count++
      }

      render() {
        return <span>{this.count}</span>
      }
    }

    @Component({ name: 'Parent' })
    class Parent extends ActViewComponent {
      child: Child | null = null

      @Ref
      parentMounted = 0

      @Mounted
      mounted(): void {
        this.parentMounted++
        this.child?.open()
      }

      @Unmounted
      unmounted(): void {
        this.parentMounted = -1
      }

      render() {
        return (
          <Child
            ref={(el: unknown) => {
              this.child = el as Child | null
            }}
          />
        )
      }
    }

    const root = mountRoot()
    const app = createApp(Parent)
    const parent = app.mount(root) as unknown as Parent
    await nextTick()

    expect(parent.child).not.toBeNull()
    expect(parent.child?.openCount).toBe(1)
    expect(parent.parentMounted).toBe(1)
    expect(root.textContent).toBe('1')

    app.unmount()
    await nextTick()
    expect(parent.child).toBeNull()
  })
})
