// ============================================================
// Bug 复现:语言切换时「无 key 元素 + 有 key 元素」混合列表不累积
//   原 VPNavBarTranslations 形态（setup 风格 + 嵌套组件）已因组件嵌套
//   方案废弃而改写为简写组件形态；验证目标不变：
//   children = [p(无key), 数组[keyed a]] 交替切换 =》 .title 恒为 1
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

describe('语言切换混合列表不累积（简写组件形态）', () => {
  it('children=[p 无key, 嵌套数组 keyed a] 交替:title 恒为 1', async () => {
    const lang = ref('en')
    const Comp = defineComponent(function () {
      return () => (
        <div class="flyout">
          <div class="items">
            <p class="title">{lang.value}</p>
            {[<a key="l" href="#">{lang.value}</a>]}
          </div>
        </div>
      )
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
    expect(host.querySelector('.title')?.textContent).toBe('en')
  })
})
