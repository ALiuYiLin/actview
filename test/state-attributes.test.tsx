// ============================================================
// stateAttributesMapping 求值合并验收（CompositeItem 新范式）
//   data-* 属性：渲染期求值合并进 merged；函数收**单个状态值**
//   （属性名去掉 data- 前缀 = state 键，对齐 Base UI getStateAttributesProps）；
//   布尔输出 "true"（PD-01/19 规范化）；undefined 不输出
// 运行：pnpm exec vitest run test/state-attributes.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, useRootElement } from '@actview/core'

// CompositeItem（新约定）：渲染体依赖每次渲染的新鲜 props 解构 / 用户传入
// render 回调的立即调用，故拆为小写分发函数；尾随「三元链」交给插件包进
// render——链中保留一个字面 JSX 分支满足编译期识别，各分支每次渲染才执行
function CompositeItem(props: any) {
  const rootRef = useRootElement()

  // 渲染期纯派生（渲染时执行）：stateAttributesMapping 求值合并（支持函数形态），
  // 函数收单个状态值：属性名去掉 data- 前缀 = state 键，对齐 Base UI
  // getStateAttributesProps；布尔输出 "true"（PD-01/19 规范化），undefined 不输出
  const deriveMerged = (): Record<string, any> => {
    const { tag, render, state, stateAttributesMapping, ...elementProps } = props

    const stateAttributes: Record<string, any> = {}
    if (stateAttributesMapping) {
      for (const key of Object.keys(stateAttributesMapping)) {
        const raw = stateAttributesMapping[key]
        const v =
          typeof raw === 'function'
            ? raw(state[key.replace('data-', '')])
            : raw
        if (v != null) stateAttributes[key] = v
      }
    }

    return { ...elementProps, ...stateAttributes }
  }

  // 分支一：用户传入 render 回调 → 立即调用（注入 merged + state + 根 ref）
  const renderAsFunction = () =>
    props.render({ ...deriveMerged(), ...props.state, ref: rootRef })

  // 分支二：render 为元素描述对象（{ type, key, props }）→ 以其类型重建并合入 merged
  const renderAsElement = () => {
    const Tag = props.render.type as any
    return <Tag key={props.render.key} {...props.render.props} {...deriveMerged()} />
  }

  return typeof props.render === 'function'
    ? renderAsFunction()
    : props.render
      ? renderAsElement()
      : // 分支三（默认）：原样元素标签；派生内联在此处，保持每渲染新鲜求值
        <component is={props.tag ?? 'div'} {...deriveMerged()} />
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'sa-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('stateAttributesMapping 求值合并', () => {
  it('布尔 state → data-* 输出 "true"（PD-01/19 规范化），undefined 不输出', async () => {
    const state = reactive({ highlighted: true, selected: false })
    function App() {
      return (
        <CompositeItem
          tag="button"
          class="ci"
          state={state}
          stateAttributesMapping={{
            'data-highlighted': (highlighted: boolean) => highlighted || undefined,
            'data-selected': (selected: boolean) => selected || undefined,
            'data-static': 'fixed',
          }}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.ci')!
    expect(el.getAttribute('data-highlighted')).toBe('true')
    expect(el.getAttribute('data-selected')).toBeNull() // false → undefined → 不输出
    expect(el.getAttribute('data-static')).toBe('fixed')
  })

  it('state 变化 → data-* 响应式更新', async () => {
    const state = reactive({ highlighted: false })
    function App() {
      return (
        <CompositeItem
          tag="div"
          class="ci2"
          state={state}
          stateAttributesMapping={{
            'data-highlighted': (highlighted: boolean) => highlighted || undefined,
          }}
        />
      )
    }
    const host = mount(App)
    expect(host.querySelector('.ci2')!.getAttribute('data-highlighted')).toBeNull()
    state.highlighted = true
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.ci2')!.getAttribute('data-highlighted')).toBe('true')
  })
})
