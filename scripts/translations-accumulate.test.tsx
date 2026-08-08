// ============================================================
// Bug 复现:嵌套组件 children = [无key p.title, keyed a] 交替更新,
//   无 key 元素是否累积(对应 VPNavBarTranslations .title 累积)
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

describe('嵌套组件 children 交替更新', () => {
  it('children [无key p, keyed a] 交替:无 key 元素不累积', async () => {
    const lang = ref('en')
    // 模拟 VPNavBarTranslations 嵌套产物(内部 __setup 返回渲染函数)
    const Comp = defineComponent(function () {
      return defineComponent(function () {
        return () => (
          <div class="items">
            <p class="title">{lang.value}</p>
            <a key={lang.value + '-link'} href="#">{lang.value}</a>
          </div>
        )
      })
    })
    const host = mount('#tacc1', Comp)
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)

    lang.value = 'zh'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)  // 无 key p 应被替换不累积
    expect(host.querySelector('.title')?.textContent).toBe('zh')

    lang.value = 'en'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })

  it('对照:简写组件(非嵌套)同样结构不累积', async () => {
    const lang = ref('en')
    const Comp = defineComponent(function () {
      return () => (
        <div class="items">
          <p class="title">{lang.value}</p>
          <a key={lang.value + '-link'} href="#">{lang.value}</a>
        </div>
      )
    })
    const host = mount('#tacc2', Comp)
    await nextTick()
    lang.value = 'zh'
    await nextTick()
    lang.value = 'en'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })
})
