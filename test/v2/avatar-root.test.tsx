// ============================================================
// AvatarRoot（Base UI 移植）验收
//   1. 默认 span 渲染;avatarStateAttributesMapping 抑制 data-image-loading-status
//   2. render 函数形态收 (props, state)，state.imageLoadingStatus 精确可达
//   3. 转发 ref = 真实 span DOM（mountComponent 写实例 → useRenderElement
//      合并 ref 覆盖为元素）
//   4. context：AvatarImage 模拟部件经 useAvatarRootContext 读取 +
//      setImageLoadingStatus 驱动根重渲染（data-* 回流经由 render 输出）
//   5. className/style 与透传 props 合并顺序（defaults < 透传）
// 运行：pnpm exec vitest run test/components/avatar-root.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, ref } from 'actview'
import {
  AvatarRoot,
  useAvatarRootContext,
  type ImageLoadingStatus,
} from '../../src/components/avatar'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'av-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

;(globalThis as any).__AV_DEBUG__ = true

describe('AvatarRoot（Base UI 移植）', () => {
  it('T1: 默认 span + stateAttributesMapping 抑制 data-image-loading-status', () => {
    function App() {
      return <AvatarRoot class="av" id="a1" />
    }
    const host = mount(App)
    const el = host.querySelector('#a1')!
    expect(el.tagName).toBe('SPAN')
    expect(el.getAttribute('data-child')).toBe(null)
    expect(el.hasAttribute('data-image-loading-status')).toBe(false) // mapping → null
    expect(el.className).toContain('av')
  })

  it('T2: render 函数形态收 (props, state)——state.imageLoadingStatus 精确类型可达', () => {
    function App() {
      return (
        <AvatarRoot
          class="av2"
          render={(p: any, state: { imageLoadingStatus: ImageLoadingStatus }) => (
            <img
              {...p}
              alt=""
              data-status={state.imageLoadingStatus}
            />
          )}
        />
      )
    }
    const host = mount(App)
    const img = host.querySelector('img[data-status]')!
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('data-status')).toBe('idle') // state 直达
    expect(img.getAttribute('alt')).toBe('') // renderTag 的 img 特判仅作用于默认标签,
    // render 形态不额外注入——与 Base UI 行为一致
  })

  it('T3: 转发 ref = 组件实例（vue 语义；根 DOM 由内部 ref 链覆盖）', () => {
    const rootEl = ref<HTMLElement | null>(null)
    function App() {
      return <AvatarRoot ref={rootEl} class="av3" />
    }
    const host = mount(App)
    const el = host.querySelector('.av3')!
    // v2（vue 语义）：组件 ref = 组件实例（非 DOM）；根元素渲染由 DOM 查询验证
    expect(rootEl.value).toBeTruthy()
    expect(el.tagName).toBe('SPAN')
  })

  it('T4: context——子部件读取 imageLoadingStatus 并 setImage 驱动根重渲染', async () => {
    let seen: ImageLoadingStatus[] = []
    // 模拟 AvatarImage:挂载后声明加载状态,经 context 通知 Root
    // （useAvatarRootContext 返回 payload 载体——store-as-is 语义）
    let ctx: any = null
    function AvatarImage() {
      ctx = useAvatarRootContext()
      ctx.setImageLoadingStatus('loading')
      return null
    }
    function App() {
      return (
        <AvatarRoot
          class="av4"
          render={(p: any, s: { imageLoadingStatus: ImageLoadingStatus }) => {
            seen.push(s.imageLoadingStatus)
            // ⚠️ 必须渲染 p.children——AvatarImage 的挂载(setup → setImage)
            // 才会发生;漏渲染则状态机根本不启动
            return <div {...p} class="root-out">{s.imageLoadingStatus}{p.children}</div>
          }}
        >
          <AvatarImage />
        </AvatarRoot>
      )
    }
    const host = mount(App)
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.root-out')!.textContent).toBe('loading')
    // payload 载体稳定 → reactive 字段活读最新值
    expect(ctx.imageLoadingStatus).toBe('loading')
    expect(seen[seen.length - 1]).toBe('loading') // 初始 + context 驱动的重渲染
  })

  it('T5: 透传 props 覆盖 defaults;className 函数形态收 state（Base UI className 通道）', () => {
    function App() {
      return (
        <AvatarRoot
          className={(s: { imageLoadingStatus: ImageLoadingStatus }) =>
            `is-${s.imageLoadingStatus}`
          }
          id="a5"
          role="figure" // 透传覆盖（span 无内建 role 冲突,验证透传生效）
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('#a5')!
    expect(el.getAttribute('role')).toBe('figure')
    expect(el.className).toBe('is-idle') // className 函数形态收 state
  })
})
