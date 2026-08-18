// ============================================================
// createElement 组件作为 children 的渲染验证（AI-003 复现）
//   A/B：普通元素 children（JSX vs createElement）
//   C/D：组件 children（JSX vs createElement）
//   E：createElement 经典三参形态（type, props, children）
// 运行：pnpm vitest run test/createElement-child.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent } from 'actview'
import { render as testingRender } from '@actview/testing'
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

  it('E: 裸函数 return createElement 树 → 插件不转换（只包 JSX/_jsx/null 返回）', () => {
    // AppE 的 return 是 createElement 调用，不是 JSX → wrapComponentFn 不识别 →
    // 保持裸函数 → isComponentVNode 不识别 → 渲染失败（与 G 同类，非 createElement 特有）
    const host = mount(AppE)
    expect(host.querySelector('.control')).toBeNull()
  })

  it('E2: 写法规避——defineComponent 手动包 render，createElement 树正常渲染', () => {
    const CEApp = defineComponent(function () {
      return () => createElement(SliderRoot, null, createElement(SliderControl, null))
    })
    const host = mount(CEApp)
    expect(host.querySelector('.control')!.textContent).toBe('ctrl')
  })

  it('F: testing render(SliderRoot, { children }) — 第二参是 options 不是 props', () => {
    // @actview/testing 的 render(component, options?)：第二参只读 options.container，
    // 不是 props —— children 被整体忽略，两种写法表现完全一致（都不传 props）
    const { container } = testingRender(SliderRoot, {
      children: <div>plain</div>,
    })
    expect(container.querySelector('.slider')!.textContent).toBe('')
  })

  it('G: 未转换的组件（小写变量，babel 插件不处理）经 createElement 作为 children → 不渲染', () => {
    // 插件只转换大写开头的具名函数/const；小写变量保留为裸函数 →
    // isComponentVNode 不识别 → 被当原生元素处理 → 渲染失败
    const sliderControl = () => <div class="control">ctrl</div>
    function AppG() {
      return <SliderRoot>{createElement(sliderControl, {})}</SliderRoot>
    }
    const host = mount(AppG)
    expect(host.querySelector('.control')).toBeNull()
  })
})
