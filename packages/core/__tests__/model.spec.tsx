// ============================================================
// @Model / @UseModel（组件内数据层）
//   - per-component 单实例 + 多组件隔离
//   - 多数据层共享同一 scope 实例
//   - @Ref/@Computed/@Watch/@Inject
//   - 生命周期复用（@Setup/@Mounted/@Unmounted 顺序）
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Computed,
  Inject,
  Model,
  Mounted,
  Provide,
  Ref,
  Setup,
  Unmounted,
  UseModel,
  Watch,
  createApp,
  getComponentMeta,
  nextTick,
} from '../src/index'
import { ComponentScope } from '../src/runtime/componentScope'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('@actview/core：@Model / @UseModel', () => {
  it('组件内 Model：@Ref/@Computed 驱动 render，方法修改状态触发更新', async () => {
    @Model
    class CounterData {
      @Ref
      count = 0

      @Computed
      get double(): number {
        return this.count * 2
      }

      increment(): void {
        this.count++
      }
    }

    @Component({ name: 'Counter' })
    class Counter extends ActViewComponent {
      @UseModel(CounterData)
      counterData!: CounterData

      render() {
        return (
          <button onClick={() => this.counterData.increment()}>
            {this.counterData.count}/{this.counterData.double}
          </button>
        )
      }
    }

    const root = mountRoot()
    createApp(Counter).mount(root)
    await nextTick()
    expect(root.textContent).toBe('0/0')

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.textContent).toBe('1/2')
  })

  it('per-component 单实例：两个组件实例的数据互不影响', async () => {
    @Model
    class CounterData {
      @Ref
      count = 0
    }

    @Component({ name: 'Counter' })
    class Counter extends ActViewComponent {
      @UseModel(CounterData)
      data!: CounterData

      render() {
        return <button onClick={() => this.data.count++}>{this.data.count}</button>
      }
    }

    const rootA = mountRoot()
    const rootB = mountRoot()
    createApp(Counter).mount(rootA)
    createApp(Counter).mount(rootB)
    await nextTick()

    rootA.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(rootA.textContent).toBe('1')
    expect(rootB.textContent).toBe('0')
  })

  it('多数据层：同一 scope 内 UserData 只有一个实例', async () => {
    @Model
    class UserData {
      @Ref
      name = 'Ada'
    }

    @Model
    class OrderData {
      @UseModel(UserData)
      user!: UserData

      @Ref
      orders = ['A']
    }

    @Component({ name: 'Page' })
    class Page extends ActViewComponent {
      @UseModel(OrderData)
      orderData!: OrderData

      @UseModel(UserData)
      userData!: UserData

      render() {
        return (
          <button
            onClick={() => {
              this.orderData.user.name = 'Grace'
            }}
          >
            {this.userData.name}/{this.orderData.user.name}/{this.orderData.orders.length}
          </button>
        )
      }
    }

    const root = mountRoot()
    createApp(Page).mount(root)
    await nextTick()
    expect(root.textContent).toBe('Ada/Ada/1')

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.textContent).toBe('Grace/Grace/1')
  })

  it('Model 生命周期复用组件语义：Setup/Mounted 先于 owner，Unmounted 后于 owner', async () => {
    const order: string[] = []

    @Model
    class Data {
      @Setup
      setup(): void {
        order.push('model.setup')
      }

      @Mounted
      mounted(): void {
        order.push('model.mounted')
      }

      @Unmounted
      unmounted(): void {
        order.push('model.unmounted')
      }
    }

    @Component({ name: 'Host' })
    class Host extends ActViewComponent {
      @UseModel(Data)
      data!: Data

      @Setup
      setup(): void {
        order.push('component.setup')
      }

      @Mounted
      mounted(): void {
        order.push('component.mounted')
      }

      @Unmounted
      unmounted(): void {
        order.push('component.unmounted')
      }

      render() {
        return <div>host</div>
      }
    }

    const root = mountRoot()
    const app = createApp(Host)
    app.mount(root)
    await nextTick()
    expect(order).toEqual([
      'model.setup',
      'component.setup',
      'model.mounted',
      'component.mounted',
    ])

    app.unmount()
    await nextTick()
    expect(order.slice(-2)).toEqual(['component.unmounted', 'model.unmounted'])
  })

  it('Model @Watch：数据字段变化调用监听方法', async () => {
    const watched: number[] = []

    @Model
    class Data {
      @Ref
      count = 0

      @Watch('count')
      onCount(value: number): void {
        watched.push(value)
      }
    }

    @Component({ name: 'Host' })
    class Host extends ActViewComponent {
      @UseModel(Data)
      data!: Data

      render() {
        return <button onClick={() => this.data.count++}>{this.data.count}</button>
      }
    }

    const root = mountRoot()
    createApp(Host).mount(root)
    await nextTick()

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.textContent).toBe('1')
    expect(watched).toEqual([1])
  })

  it('Model @Inject：从祖先组件 provide 取值', async () => {
    @Model
    class ThemeData {
      @Inject('theme')
      theme!: string
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @UseModel(ThemeData)
      data!: ThemeData

      render() {
        return <span>{this.data.theme}</span>
      }
    }

    @Component({ name: 'ThemeProvider' })
    class ThemeProvider extends ActViewComponent {
      @Provide()
      theme = 'dark'

      render() {
        return <Child />
      }
    }

    const root = mountRoot()
    createApp(ThemeProvider).mount(root)
    await nextTick()
    expect(root.textContent).toBe('dark')
  })

  it('@Model 不允许实现 render；@UseModel 需要显式 Model token', () => {
    expect(() => {
      @Model
      class Bad {
        render() {
          return null
        }
      }
      return Bad
    }).toThrow(/不能实现 render/)
  })

  it('Model 循环依赖：直接报错并给出链路', () => {
    @Model
    class CycleA {}

    @Model
    class CycleB {}

    getComponentMeta(CycleA).models.set('b', CycleB)
    getComponentMeta(CycleB).models.set('a', CycleA)

    const owner = { props: {}, injects: {}, scope: {} } as any
    const scope = new ComponentScope(owner)
    expect(() => scope.resolve(CycleA)).toThrow(/循环依赖/)
  })
})
