// ============================================================
// useCompositeItem 注册的 watch 桥接验收
//   watch(elementRef, flush:'sync') 观察完整生命周期：
//   null→元素（挂载注册）/ 元素→元素（换根重注册）/ 元素→null（卸载注销）
//   关键：useRootElement 卸载置 null（对齐模板 ref 语义）+ flush:'sync'
//   （微任务 flush 会在 scope.stop() 后丢失回调）
// 运行：pnpm exec vitest run test/composite-registration.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, defineComponent, reactive, watch, useRootElement } from '@actview/core'

// useCompositeItem 注册模式：elementRef 生命周期驱动 listRef 注册/注销
function useCompositeItem(
  register: (el: HTMLElement) => void,
  unregister: (el: HTMLElement) => void
) {
  const elementRef = useRootElement()
  // flush:'sync'：卸载时 beforeUnmount 置 null → 同步触发（scope.stop() 之前），
  // 微任务 flush 会在 effect 停止后丢失回调
  watch(
    elementRef,
    (el, prevEl) => {
      if (el) register(el)
      else if (prevEl) unregister(prevEl) // 卸载：用旧元素注销
    },
    { flush: 'sync' }
  )
  return elementRef
}

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'reg-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('composite 注册 watch 桥接', () => {
  it('挂载注册 / 换根重注册 / 卸载注销（useRootElement 卸载置 null 是关键）', async () => {
    const list: any[] = []
    const register = (el: any) => list.push(el)
    const unregister = (el: any) => {
      const i = list.indexOf(el)
      if (i >= 0) list.splice(i, 1)
    }
    const state = reactive({ swap: false, show: true })

    function Item(props: any) {
      useCompositeItem(register, unregister)
      return props.swap ? <div class="b">B</div> : <div class="a">A</div>
    }

    function App() {
      // show=false → Item 从树中移除 → 真实卸载（composite 项被移除的场景）
      return state.show ? <Item swap={state.swap} /> : <div class="empty" />
    }
    const host = mount(App)
    await new Promise((r) => setTimeout(r, 0))
    // 挂载 → null→元素 → 注册
    expect(list).toHaveLength(1)
    expect(list[0].classList.contains('a')).toBe(true)

    // 换根：a → b → 元素→元素 → 重注册
    state.swap = true
    await new Promise((r) => setTimeout(r, 0))
    expect(list).toHaveLength(1)
    expect(list[0].classList.contains('b')).toBe(true)

    // 移除 → 元素→null → 注销
    state.show = false
    await new Promise((r) => setTimeout(r, 0))
    expect(list).toHaveLength(0)
  })
})
