// ============================================================
// createElement 组件作为 children 的渲染验证（AI-003 复现）
//   A/B：普通元素 children（JSX vs createElement）
//   C/D：组件 children（JSX vs createElement）
//   E：createElement 经典三参形态（type, props, children）
// 拆分自 test/createElement-child.test.tsx
// 运行：pnpm exec vitest run test/renderer/create-element-children.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, defineComponent } from '@actview/core'
import { createElement } from '@actview/jsx'

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'ce-child-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function SliderRoot(props: any) {
  return <div class="slider">{props.children}</div>
}

function SliderControl(props: any) {
  return <div class="control">ctrl</div>
}

// 具名函数组件（babel 插件才会转换；内联箭头不会被转换）
function AppA() {
  return (
    <SliderRoot>
      <div>plain</div>
    </SliderRoot>
  )
}
function AppB() {
  return <SliderRoot>{createElement('div', {}, 'plain')}</SliderRoot>
}
function AppC() {
  return (
    <SliderRoot>
      <SliderControl />
    </SliderRoot>
  )
}
function AppD() {
  return <SliderRoot>{createElement(SliderControl, {})}</SliderRoot>
}
function AppE() {
  return createElement(SliderRoot, null, createElement(SliderControl, null))
}

describe('createElement 组件 children', () => {
  it('A: children = <div>plain</div>（JSX 元素）', () => {
    const host = mount(AppA)
    expect(host.querySelector('.slider')!.textContent).toBe('plain')
  })

  it('B: children = createElement("div", {}, "plain")（createElement 元素）', () => {
    const host = mount(AppB)
    expect(host.querySelector('.slider')!.textContent).toBe('plain')
  })

  it('C: children = <SliderControl />（JSX 组件）', () => {
    const host = mount(AppC)
    expect(host.querySelector('.control')!.textContent).toBe('ctrl')
  })

  it('D: children = createElement(SliderControl, {})（createElement 组件）', () => {
    const host = mount(AppD)
    expect(host.querySelector('.control')!.textContent).toBe('ctrl')
  })

  it('E: 裸函数 return createElement 树 → PD-07 运行时兜底明确报错', () => {
    // AppE 的 return 是 createElement 调用，不是 JSX → 插件不转换 → 保持裸函数；
    // PD-07 后运行时识别函数组件，调一次发现返回 VNode 而非 render 函数 →
    // 抛出明确报错（替代旧的 InvalidCharacterError/静默失败）
    expect(() => mount(AppE)).toThrow(/必须返回 render 函数/)
  })

  it('E2: 写法规避——defineComponent 手动包 render，createElement 树正常渲染', () => {
    const CEApp = defineComponent(function () {
      return () => createElement(SliderRoot, null, createElement(SliderControl, null))
    })
    const host = mount(CEApp)
    expect(host.querySelector('.control')!.textContent).toBe('ctrl')
  })

  it('G: 未转换组件（小写变量）→ PD-07 兜底识别后经错误链上报，不再当原生元素', () => {
    // 插件只转换大写开头的具名函数/const；小写变量保留为裸函数 →
    // PD-07 后按组件分支处理（调用一次返回 VNode）→ 明确报错走 handleError 链。
    // 无 ErrorBoundary 时渲染错误向上抛出（React 语义，对齐 React 18 根渲染错误），
    // console.error 在抛出前上报（错误链 + 抛出双通道）。
    const sliderControl = () => <div class="control">ctrl</div>
    function AppG() {
      return <SliderRoot>{createElement(sliderControl, {})}</SliderRoot>
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => mount(AppG)).toThrow()
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('组件渲染错误'),
        expect.any(Error),
      )
    } finally {
      errSpy.mockRestore()
    }
  })
})