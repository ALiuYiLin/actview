// ============================================================
// Bug 复现:完全等价 VPNavBarTranslations 形态
//   defineComponent(外层) → defineComponent(内部 __setup 读 ref) → 渲染 [p无key, 嵌套数组[keyed a]]
// ============================================================
import { describe, it, expect } from 'vitest'
import { createApp, ref, nextTick, defineComponent } from 'actview'

function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

describe('等价 VPNavBarTranslations 嵌套形态', () => {
  it('内部 __setup 读 ref,children=[p, [keyed a]] 交替:title 不累积', async () => {
    const lang = ref('en')
    // 等价产物:外层 setup(模拟 useLangs) + 内部 __setup(读响应式) + 渲染
    const Comp = defineComponent(function () {
      // 外层 setup
      const current = lang
      return defineComponent(function () {
        // 内部 __setup:读响应式做条件 + 返回渲染函数
        if (!current.value) return null
        return () => (
          <div class="flyout">
            <div class="items">
              <p class="title">{current.value}</p>
              {[<a key="l" href="#">{current.value}</a>]}
            </div>
          </div>
        )
      })
    })
    const host = mount('#trel1', Comp)
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
    expect(host.querySelector('.title')?.textContent).toBe('en')

    lang.value = 'zh'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
    expect(host.querySelector('.title')?.textContent).toBe('zh')

    lang.value = 'en'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })
})
