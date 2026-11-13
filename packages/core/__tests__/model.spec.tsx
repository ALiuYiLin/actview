// ============================================================
// @Model / @UseModel（组件内数据层）
//   - per-component 单实例 + 多组件隔离
//   - 多数据层共享同一 scope 实例
//   - @Ref/@Computed/@Watch/@Inject
//   - 生命周期复用（@Setup/@Mounted/@Unmounted 顺序）
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActViewComponent,
  Component,
  Computed,
  Inject,
  Model,
  Mounted,
  Prop,
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

/** async Model/组件 setup 的 pending 会跨多个微任务批次 */
async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await nextTick()
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

  it('async Model @Setup：等待 resolve 后再渲染组件', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    @Model
    class AsyncData {
      @Ref
      ready = false

      @Setup
      async setup(): Promise<void> {
        await gate
        this.ready = true
      }
    }

    @Component({ name: 'AsyncHost' })
    class AsyncHost extends ActViewComponent {
      @UseModel(AsyncData)
      data!: AsyncData

      render() {
        return <span>{this.data.ready ? 'ready' : 'waiting'}</span>
      }
    }

    const root = mountRoot()
    createApp(AsyncHost).mount(root)
    await flush()
    expect(root.textContent).toBe('')

    release()
    await flush()
    expect(root.textContent).toBe('ready')
  })

  it('Model @Prop：投影 owner 组件 @Prop（默认 pre setup 可读）', async () => {
    @Model
    class PropData {
      @Prop
      initCount!: number

      @Ref
      count = 0

      @Setup
      async setup(): Promise<void> {
        await Promise.resolve()
        this.count = this.initCount
      }
    }

    @Component({ name: 'PropHost' })
    class PropHost extends ActViewComponent {
      @Prop
      initCount = 7

      @UseModel(PropData)
      data!: PropData

      render() {
        return <span>{this.data.count}</span>
      }
    }

    const root = mountRoot()
    const app = createApp(PropHost)
    const instance = app.mount(root) as unknown as PropHost
    await flush()
    expect(root.textContent).toBe('7')

    // Model @Prop 只读
    expect(() => {
      ;(instance.data as PropData).initCount = 9
    }).toThrow(/只读/)
  })

  it('Model @Prop：组件未声明同名 prop → mount 报错', () => {
    @Model
    class MissingData {
      @Prop
      missing!: number
    }

    @Component({ name: 'MissingHost' })
    class MissingHost extends ActViewComponent {
      @UseModel(MissingData)
      data!: MissingData

      render() {
        return <span>missing</span>
      }
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = mountRoot()
    expect(() => createApp(MissingHost).mount(root)).toThrow(/未在组件/)
    errorSpy.mockRestore()
  })

  it('Model @Provide：跨组件 provide，后代 @Inject 读取', async () => {
    @Model
    class ThemeData {
      @Prop
      theme!: string

      @Provide()
      value = ''

      @Setup
      setup(): void {
        this.value = this.theme
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @Inject('value')
      theme!: string

      render() {
        return <span>{this.theme}</span>
      }
    }

    @Component({ name: 'ThemeHost' })
    class ThemeHost extends ActViewComponent {
      @Prop
      theme = 'dark'

      @UseModel(ThemeData)
      data!: ThemeData

      render() {
        return <Child />
      }
    }

    const root = mountRoot()
    createApp(ThemeHost).mount(root)
    await flush()
    expect(root.textContent).toBe('dark')
  })

  it('@Setup("after")：Model setup 在组件 setup 之后执行', async () => {
    const order: string[] = []

    @Model
    class AfterData {
      @Setup('after')
      setup(): void {
        order.push('model.after')
      }
    }

    @Component({ name: 'OrderHost' })
    class OrderHost extends ActViewComponent {
      @UseModel(AfterData)
      data!: AfterData

      @Setup
      setup(): void {
        order.push('component.setup')
      }

      render() {
        return <span>order</span>
      }
    }

    const root = mountRoot()
    createApp(OrderHost).mount(root)
    await flush()
    expect(order).toEqual(['component.setup', 'model.after'])
  })
})
