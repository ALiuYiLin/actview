// ============================================================
// SVG 命名空间渲染（拆分自 test/verify.test.tsx + test/p0.test.tsx）
//   场景 25（verify）+ P0: SVG 命名空间渲染
// 运行：pnpm exec vitest run test/renderer/svg.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  ref,
  shallowRef,
  triggerRef,
  watch,
  watchEffect,
  onWatcherCleanup,
  effectScope,
  onScopeDispose,
  toValue,
  computed,
  nextTick,
  createApp
} from '@actview/core'
import { runEffect } from '@actview/core'

/** p0 风格 mount：创建带唯一 id 的宿主元素并挂载组件 */
let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'svg-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

// ------------------------------------------------------------
// P0: SVG 命名空间渲染（来源 p0.test.tsx）
// ------------------------------------------------------------
describe('P0: SVG 命名空间渲染', () => {
  it('svg / circle 用 createElementNS 创建', () => {
    function App() {
      return (
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="red" />
        </svg>
      )
    }
    const host = mount(App)
    const svg = host.querySelector('svg')!
    const circle = host.querySelector('circle')!
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(circle.getAttribute('r')).toBe('40')
    expect(circle.getAttribute('fill')).toBe('red')
  })

  it('svg 的 class 走 setAttribute（真实浏览器中 SVGElement.className 是 getter-only）', () => {
    // 真实浏览器里 SVGElement.prototype.className 是只读的 SVGAnimatedString
    // （只有 getter 没有 setter），直接赋值在严格模式下抛
    // TypeError: Cannot set property className of #<SVGElement> which has only a getter。
    // happy-dom 未实现该行为，这里临时在 SVGElement 原型上模拟只读 className，
    // 回归验证 renderer 的 setProp 对 SVG class 走 setAttribute 而不是属性赋值。
    const svgProto: any = Object.getPrototypeOf(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    )
    const original = Object.getOwnPropertyDescriptor(svgProto, 'className')
    Object.defineProperty(svgProto, 'className', {
      configurable: true,
      get(this: Element) {
        return this.getAttribute('class') ?? ''
      },
    })
    try {
      function App() {
        return (
          <svg class="lucide lucide-icon" viewBox="0 0 24 24">
            <path d="M0 0h24v24H0z" />
          </svg>
        )
      }
      const host = mount(App)
      const svg = host.querySelector('svg')!
      expect(svg.getAttribute('class')).toBe('lucide lucide-icon')
    } finally {
      if (original) {
        Object.defineProperty(svgProto, 'className', original)
      } else {
        delete svgProto.className
      }
    }
  })
})