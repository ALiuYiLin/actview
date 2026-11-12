// 测试专用：把旧函数式 setup 适配成 @Component 类组件。
// 公开 API 不再提供 defineComponent；测试仍需要大量“setup 返回 render”的写法，
// 因此只在测试目录内提供该适配器。

import { ActViewComponent, Component, Setup } from '../src/index'

export function testComponent<P = Record<string, any>>(
  setup: (props: P) => any,
  name = 'TestComponent',
) {
  @Component({ name })
  class TestComponent extends ActViewComponent<P> {
    private _render: (() => any) | null = null

    @Setup
    setupComponent() {
      const result = setup(this.$props as P)
      // 兼容 async setup：setup 返回 Promise<RenderFunction>。类组件 setup
      // 返回 Promise 时，渲染器按现有 Suspense 协议先渲染 null 再切回。
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        return Promise.resolve(result).then((render) => {
          this._render = render as () => any
          return render
        })
      }
      this._render = result as () => any
    }

    render() {
      return this._render ? this._render() : null
    }
  }

  return TestComponent
}
