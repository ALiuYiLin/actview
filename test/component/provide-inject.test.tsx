// ============================================================
// provide / inject — 跨层级注入（拆分自 test/verify.test.tsx 场景 32）
// 运行：pnpm exec vitest run test/component/provide-inject.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, ref, nextTick, provide, useInjects } from 'actview'

/** 创建带 id 的宿主元素并挂载组件 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 场景 32：provide / inject
// ------------------------------------------------------------
describe('场景 32：provide / inject', () => {
  it('父 provide → 孙经 ctx.injects 读取（跨中间组件）', () => {
    function Provider() {
      provide('theme', 'dark')
      return <Mid />
    }
    function Mid() {
      return <Leaf />
    }
    function Leaf(_props: any, ctx?: any) {
      return <div class="leaf">{ctx.injects.theme}</div>
    }
    const host = mount('#s32-1', Provider)
    expect(host.querySelector('.leaf')!.textContent).toBe('dark')
  })

  it('未调用 provide 的组件共享父注入引用（零拷贝）', () => {
    let parentTable: any
    let midTable: any
    let leafTable: any
    function Provider(_props: any, ctx?: any) {
      provide('a', 1)
      parentTable = ctx.injects
      return <Mid />
    }
    function Mid(_props: any, ctx?: any) {
      midTable = ctx.injects
      return <Leaf />
    }
    function Leaf(_props: any, ctx?: any) {
      leafTable = ctx.injects
      return <div>leaf</div>
    }
    mount('#s32-2', Provider)
    expect(parentTable).toBe(midTable) // 未 provide：同一引用，零拷贝
    expect(midTable).toBe(leafTable)
    expect(leafTable.a).toBe(1)
  })

  it('同名覆盖 + copy-on-write 不污染父表', () => {
    let parentTable: any
    let childTable: any
    function Provider(_props: any, ctx?: any) {
      provide('theme', 'dark')
      parentTable = ctx.injects
      return <Child />
    }
    function Child(_props: any, ctx?: any) {
      provide('theme', 'light') // 同名覆盖
      childTable = ctx.injects
      return <Leaf />
    }
    function Leaf(_props: any, ctx?: any) {
      return <div class="leaf">{ctx.injects.theme}</div>
    }
    const host = mount('#s32-3', Provider)
    expect(host.querySelector('.leaf')!.textContent).toBe('light') // 深层看到覆盖值
    expect(parentTable.theme).toBe('dark') // 父表未被污染
    expect(childTable).not.toBe(parentTable) // 已拷贝隔离
    expect(childTable.theme).toBe('light')
  })

  it('新增 key 保留继承的其他 key', () => {
    function Provider() {
      provide('a', 1)
      return <Child />
    }
    function Child() {
      provide('b', 2) // 新增 key
      return <Leaf />
    }
    function Leaf(_props: any, ctx?: any) {
      return <div class="leaf">{ctx.injects.a}-{ctx.injects.b}</div>
    }
    const host = mount('#s32-4', Provider)
    expect(host.querySelector('.leaf')!.textContent).toBe('1-2')
  })

  it('根组件（无父）injects 为空对象，provide 可用', () => {
    function Root(_props: any, ctx?: any) {
      expect(Object.keys(ctx.injects).length).toBe(0)
      provide('k', 'v')
      return <div class="root">{ctx.injects.k}</div>
    }
    const host = mount('#s32-5', Root)
    expect(host.querySelector('.root')!.textContent).toBe('v')
  })

  it('provide ref → 注入保持响应式，更新驱动 DOM', async () => {
    const count = ref(0)
    function Provider() {
      provide('count', count)
      return <Leaf />
    }
    function Leaf(_props: any, ctx?: any) {
      return <p class="c">{ctx.injects.count.value}</p>
    }
    const host = mount('#s32-6', Provider)
    expect(host.querySelector('.c')!.textContent).toBe('0')
    count.value = 5
    await nextTick()
    expect(host.querySelector('.c')!.textContent).toBe('5')
  })

  it('setup 外调用 provide 警告且不生效', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    provide('x', 1) // 无 currentInstance
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('useInjects(key) 与 useInjects()（顶层 API）', () => {
    function Provider() {
      provide('theme', 'dark')
      provide('count', 3)
      return <Leaf />
    }
    function Leaf() {
      const theme = useInjects('theme')
      const count = useInjects('count')
      const all = useInjects()
      return (
        <div class="leaf">
          {theme}-{count}-{Object.keys(all).length}
        </div>
      )
    }
    const host = mount('#s32-7', Provider)
    expect(host.querySelector('.leaf')!.textContent).toBe('dark-3-2')
  })

  it('useInjects(key) 未提供返回 undefined', () => {
    function Panel(_props: any) {
      const missing = useInjects('nope')
      return (
        <div class="panel">
          {missing ?? 'none'}
        </div>
      )
    }
    const host = mount('#s32-8', Panel)
    expect(host.querySelector('.panel')!.textContent).toBe('none')
  })
})