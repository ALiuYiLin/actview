// ============================================================
// Bug 复现:children = [无key p, 嵌套数组[link]] 交替更新,是否累积
//   对应 VPNavBarTranslations: children=[<p class=title/>, localeLinks.map(...)]
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

describe('嵌套 children 数组', () => {
  it('children = [p, [keyed a]] 交替:无 key p 不累积', async () => {
    const lang = ref('en')
    const Comp = defineComponent(function () {
      return () => (
        <div class="items">
          <p class="title">{lang.value}</p>
          {[<a key="lnk" href="#">{lang.value}</a>]}
        </div>
      )
    })
    const host = mount('#tnc1', Comp)
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)

    lang.value = 'zh'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
    expect(host.querySelector('.title')?.textContent).toBe('zh')

    lang.value = 'en'
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })

  it('嵌套数组内容变化(如 map 结果不同):无 key p 不累积', async () => {
    const lang = ref('en')
    const links = ref([{ text: 'en', key: 'e' }])
    const Comp = defineComponent(function () {
      return () => (
        <div class="items">
          <p class="title">{lang.value}</p>
          {links.value.map((l) => <a key={l.key} href="#">{l.text}</a>)}
        </div>
      )
    })
    const host = mount('#tnc2', Comp)
    await nextTick()
    lang.value = 'zh'
    links.value = [{ text: 'zh', key: 'z' }]
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
    expect(host.querySelector('.title')?.textContent).toBe('zh')
    await nextTick()
    expect(host.querySelectorAll('.title').length).toBe(1)
  })
})
