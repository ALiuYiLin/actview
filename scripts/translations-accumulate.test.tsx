// ============================================================
// Bug 复现:children [无 key p, keyed a] 交替 =》 无 key 元素不累积
//   原 VPNavBarTranslations 嵌套产物形态已因组件嵌套方案废弃而改写为
//   简写组件形态；验证目标不变：交替切换 .title 恒为 1
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

describe('嵌套组件 children 交替更新（简写形态）', () => {
  it('children [无key p, keyed a] 交替:无 key 元素不累积', async () => {
    const lang = ref('en')
    const Comp = defineComponent(function () {
      return () => (
        <div class="items">
          <p class="title">{lang.value}</p>
          <a key={lang.value + '-link'} href="#">{lang.value}</a>
        </div>
      )
    })
    const host = mount('#tacc1', Comp)
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)

    lang.value = 'zh'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1) // 无 key p 应被替换不累积
    expect(host.querySelector('.title')?.textContent).toBe('zh')

    lang.value = 'en'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })
})
