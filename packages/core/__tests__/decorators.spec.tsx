// ============================================================
// 装饰器扩展验收：
//   - @Reactive：对象字段响应式（this.profile.name）
//   - @Computed：getter 派生值（缓存 + 依赖更新）
//   - @Watch：方法监听字段（immediate 可选）
//   - @Provide / @Inject：跨层级注入 + 默认值
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Computed,
  Inject,
  Prop,
  Provide,
  Reactive,
  Ref,
  Setup,
  Watch,
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

describe('@actview/core：数据 / 注入装饰器', () => {
  it('@Reactive：对象字段嵌套修改触发重渲染', async () => {
    let renders = 0

    @Component({ name: 'Profile' })
    class Profile extends ActViewComponent {
      @Reactive
      user = { name: 'Ada', age: 36 }

      render() {
        renders++
        return (
          <button
            onClick={() => {
              this.user.name = this.user.name === 'Ada' ? 'Grace' : 'Ada'
            }}
          >
            {this.user.name}/{this.user.age}
          </button>
        )
      }
    }

    const root = mountRoot()
    createApp(Profile).mount(root)
    await nextTick()
    expect(root.textContent).toBe('Ada/36')
    expect(renders).toBe(1)

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.textContent).toBe('Grace/36')
    expect(renders).toBe(2)
  })

  it('@Computed：getter 派生值随依赖更新', async () => {
    let computedCalls = 0

    @Component({ name: 'ComputedCounter' })
    class ComputedCounter extends ActViewComponent {
      @Ref
      count = 1

      @Computed
      get double(): number {
        computedCalls++
        return this.count * 2
      }

      render() {
        return (
          <button
            onClick={() => {
              this.count++
            }}
          >
            {this.count}/{this.double}
          </button>
        )
      }
    }

    const root = mountRoot()
    createApp(ComputedCounter).mount(root)
    await nextTick()
    expect(root.textContent).toBe('1/2')
    expect(computedCalls).toBe(1)

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(root.textContent).toBe('2/4')
    expect(computedCalls).toBe(2)
  })

  it('@Watch：字段变化调用方法；immediate 首次立即触发', async () => {
    const logs: string[] = []

    @Component({ name: 'Watched' })
    class Watched extends ActViewComponent {
      @Ref
      count = 0

      @Watch('count', { immediate: true })
      onCount(value: number, oldValue: number | undefined): void {
        logs.push(`${oldValue}->${value}`)
      }

      @Watch('count')
      onCountAgain(value: number): void {
        logs.push(`again:${value}`)
      }

      render() {
        return (
          <button
            onClick={() => {
              this.count++
            }}
          >
            {this.count}
          </button>
        )
      }
    }

    const root = mountRoot()
    createApp(Watched).mount(root)
    await nextTick()
    // immediate 在挂载 setup 后立即触发（oldValue = undefined）
    expect(logs).toEqual(['undefined->0'])

    root.querySelector('button')!.dispatchEvent(new Event('click'))
    await nextTick()
    expect(logs).toContain('0->1')
    expect(logs).toContain('again:1')
  })

  it('@Provide / @Inject：跨层级注入 + 默认值', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      @Inject('theme')
      theme!: string

      @Inject('missing', 'fallback')
      fallback!: string

      render() {
        return (
          <span>
            {this.theme}:{this.fallback}
          </span>
        )
      }
    }

    @Component({ name: 'Provider' })
    class Provider extends ActViewComponent {
      @Provide()
      theme = 'dark'

      @Ref
      count = 0

      @Prop
      initial = 0

      @Setup
      setup(): void {
        this.count = this.initial
      }

      render() {
        return (
          <div>
            <Child />
            <button
              onClick={() => {
                this.count++
              }}
            >
              {this.count}
            </button>
          </div>
        )
      }
    }

    const root = mountRoot()
    createApp(Provider, { initial: 2 }).mount(root)
    await nextTick()

    expect(root.querySelector('span')?.textContent).toBe('dark:fallback')
    expect(root.querySelector('button')?.textContent).toBe('2')
  })
})
