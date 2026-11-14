// ============================================================
// attrs 透传（Vue 风格）
//   - class / style / onXxx / 其它属性落到组件根元素
//   - class/style/事件合并
//   - inheritAttrs:false + $attrs
//   - Fragment 根不透传并告警
//   - 父更新 attrs 更新 DOM
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Ref,
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

describe('@actview/core：attrs 透传', () => {
  it('class/style/onXxx/普通属性落到根元素并合并', async () => {
    let rootClicks = 0
    let parentClicks = 0

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return (
          <button
            class="root"
            style={{ color: 'red' }}
            onClick={() => {
              rootClicks++
            }}
          >
            btn
          </button>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return (
          <Child
            class="parent"
            id="from-parent"
            data-x="1"
            style={{ background: 'blue' }}
            onClick={() => {
              parentClicks++
            }}
          />
        )
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()

    const el = root.querySelector('button')!
    expect(el.classList.contains('root')).toBe(true)
    expect(el.classList.contains('parent')).toBe(true)
    expect(el.id).toBe('from-parent')
    expect(el.getAttribute('data-x')).toBe('1')
    expect((el as HTMLElement).style.color).toBe('red')
    expect((el as HTMLElement).style.background).toBe('blue')

    el.dispatchEvent(new Event('click'))
    expect(rootClicks).toBe(1)
    expect(parentClicks).toBe(1)
  })

  it('inheritAttrs:false：不自动透传，$attrs 可读', async () => {
    @Component({ name: 'Child', inheritAttrs: false })
    class Child extends ActViewComponent {
      render() {
        return <div class="root">child</div>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      child: Child | null = null

      @Ref
      cls = 'parent'

      render() {
        return (
          <Child
            ref={(el: unknown) => {
              this.child = el as Child | null
            }}
            class={this.cls}
            id="from-parent"
          />
        )
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await nextTick()

    const el = root.querySelector('div')!
    expect(el.className).toBe('root')
    expect(el.id).toBe('')
    expect(instance.child?.$attrs.class).toBe('parent')
    expect(instance.child?.$attrs.id).toBe('from-parent')

    instance.cls = 'next'
    await nextTick()
    expect(instance.child?.$attrs.class).toBe('next')
    expect(el.className).toBe('root')
  })

  it('父更新 attrs：class 更新到根元素', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return <div class="root">child</div>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      cls = 'a'

      render() {
        return <Child class={this.cls} />
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await nextTick()

    let el = root.querySelector('div')!
    expect(el.classList.contains('root')).toBe(true)
    expect(el.classList.contains('a')).toBe(true)

    instance.cls = 'b'
    await nextTick()
    el = root.querySelector('div')!
    expect(el.classList.contains('root')).toBe(true)
    expect(el.classList.contains('a')).toBe(false)
    expect(el.classList.contains('b')).toBe(true)
  })

  it('根是另一个组件：attrs 继续向下透传', async () => {
    @Component({ name: 'Grand' })
    class Grand extends ActViewComponent {
      render() {
        return <div class="grand">grand</div>
      }
    }

    @Component({ name: 'Mid' })
    class Mid extends ActViewComponent {
      render() {
        return <Grand />
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Mid class="parent" />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()
    const el = root.querySelector('div')!
    expect(el.classList.contains('grand')).toBe(true)
    expect(el.classList.contains('parent')).toBe(true)
  })

  it('scopedId → 根元素 data-v-* 属性，而不是 scopedid', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return <div class="root">child</div>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      scope = 'data-v-abc'

      render() {
        return <Child scopedId={this.scope} />
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await nextTick()

    let el = root.querySelector('div')!
    expect(el.hasAttribute('data-v-abc')).toBe(true)
    expect(el.getAttribute('data-v-abc')).toBe('')
    expect(el.hasAttribute('scopedid')).toBe(false)

    instance.scope = 'data-v-next'
    await nextTick()
    el = root.querySelector('div')!
    expect(el.hasAttribute('data-v-abc')).toBe(false)
    expect(el.hasAttribute('data-v-next')).toBe(true)
  })

  it('子组件根 scopedId 与父组件 scopedId 合并，而不是覆盖', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return (
          <div class="root" scopedId="data-v-child">
            child
          </div>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      @Ref
      parentScope = 'data-v-parent'

      render() {
        return <Child scopedId={this.parentScope} />
      }
    }

    const root = mountRoot()
    const app = createApp(App)
    const instance = app.mount(root) as unknown as App
    await nextTick()

    let el = root.querySelector('div')!
    expect(el.hasAttribute('data-v-child')).toBe(true)
    expect(el.hasAttribute('data-v-parent')).toBe(true)

    instance.parentScope = 'data-v-next'
    await nextTick()
    el = root.querySelector('div')!
    expect(el.hasAttribute('data-v-child')).toBe(true)
    expect(el.hasAttribute('data-v-parent')).toBe(false)
    expect(el.hasAttribute('data-v-next')).toBe(true)
  })

  it('scopeId 别名与 scopedId 可以混合合并', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return <div scopeId="data-v-child">child</div>
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Child scopedId="data-v-parent" />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()

    const el = root.querySelector('div')!
    expect(el.hasAttribute('data-v-child')).toBe(true)
    expect(el.hasAttribute('data-v-parent')).toBe(true)
  })

  it('Fragment 根节点：不透传并给出开发警告', async () => {
    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return (
          <>
            <span>A</span>
            <span>B</span>
          </>
        )
      }
    }

    @Component({ name: 'App' })
    class App extends ActViewComponent {
      render() {
        return <Child class="parent" />
      }
    }

    const root = mountRoot()
    createApp(App).mount(root)
    await nextTick()

    ;(expect('无法自动继承') as any).toHaveBeenWarned()
    const spans = root.querySelectorAll('span')
    expect(spans).toHaveLength(2)
    expect(spans[0].classList.contains('parent')).toBe(false)
    expect(spans[1].classList.contains('parent')).toBe(false)
  })
})
