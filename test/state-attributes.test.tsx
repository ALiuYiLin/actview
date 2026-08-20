// ============================================================
// stateAttributesMapping 求值合并验收（CompositeItem 新范式）
//   data-* 属性：渲染期求值合并进 merged；函数收**单个状态值**
//   （属性名去掉 data- 前缀 = state 键，对齐 Base UI getStateAttributesProps）；
//   布尔输出 "true"（PD-01/19 规范化）；undefined 不输出
// 运行：pnpm exec vitest run test/state-attributes.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, useRootElement } from 'actview'

// 修正版 CompositeItem：mapping 渲染期求值（支持函数形态），合并进 merged
function CompositeItem(props: any) {
  const rootRef = useRootElement()
  return () => {
    const { tag = 'div', render, state, stateAttributesMapping, ...elementProps } = props

    // stateAttributesMapping 求值合并（渲染期；函数收单个状态值：
    // 属性名去掉 data- 前缀 = state 键，对齐 Base UI getStateAttributesProps）
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

    const merged = { ...elementProps, ...stateAttributes }

    if (typeof render === 'function') {
      return render({ ...merged, ...state, ref: rootRef })
    }
    if (render) {
      const Tag = render.type as any
      return <Tag key={render.key} {...render.props} {...merged} />
    }
    return <component is={tag} {...merged} />
  }
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
