// ============================================================
// 自我 patch 短路 / 语言切换不累积（拆分自 test/verify.test.tsx +
//   test/translations-real.test.tsx + test/translations-accumulate.test.tsx）
// 运行：pnpm exec vitest run test/renderer/self-patch.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, reactive, readonly, shallowReactive, markRaw, nextTick, computed, ref, isRef, unref, unrefs, toRef, toRefs, watch, watchEffect, onMounted, onUpdated, onBeforeUnmount, onUnmounted, provide, useInjects, renderToString, Teleport, Transition, KeepAlive, ErrorBoundary, Suspense, lazy, defineComponent } from '@actview/core'
import { jsx } from '@actview/jsx'
import { patch } from '@actview/core'
import { runEffect } from '@actview/core'

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
// 场景 31：同一对象自我 patch 短路（来源 verify 场景 31）
// ------------------------------------------------------------
describe('场景 31：同一对象自我 patch 短路（语言切换 title 不累积）', () => {
  it('children [无key p(同一对象), keyed a] 连续 4 次自我 patch：title 恒 1', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    // 模拟组件缓存 subTree：children 里的 p 是同一 vnode 对象被多次 patch 复用
    const cachedP = jsx('p', { class: 'title', children: 'en' })
    const makeTree = () =>
      jsx('div', { children: [cachedP, jsx('a', { key: 'l' }, 'link')] })

    let old = makeTree()
    patch(null, old, container)
    const titles = () => container.querySelectorAll('.title').length
    const links = () => container.querySelectorAll('a').length
    expect(titles()).toBe(1)

    for (let i = 0; i < 4; i++) {
      const next = makeTree()
      patch(old, next, container)
      old = next
      expect(titles()).toBe(1) // 无 key p 不累积
      expect(links()).toBe(1) // 有 key a 不累积
    }
  })

  it('对照：非同一对象（正常新渲染）也正常', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const makeTree = () =>
      jsx('div', {
        children: [
          jsx('p', { class: 'title', children: 'en' }),
          jsx('a', { key: 'l' }, 'link'),
        ],
      })
    let old = makeTree()
    patch(null, old, container)
    for (let i = 0; i < 4; i++) {
      const next = makeTree() // 每次全新对象（正常渲染）
      patch(old, next, container)
      old = next
      expect(container.querySelectorAll('.title').length).toBe(1)
    }
  })

  it('patch(old, new) 同对象顶层短路：DOM 不变', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const tree = jsx('div', { children: [jsx('p', { class: 'x' }, 'x')] })
    patch(null, tree, container)
    expect(container.querySelectorAll('.x').length).toBe(1)
    patch(tree, tree, container) // 同一对象自我 patch
    expect(container.querySelectorAll('.x').length).toBe(1)
  })
})

// ------------------------------------------------------------
// 语言切换混合列表不累积（来源 test/translations-real.test.tsx）
// ------------------------------------------------------------
describe('语言切换混合列表不累积（简写组件形态）', () => {
  it('children=[p 无key, 嵌套数组 keyed a] 交替:title 恒 1', async () => {
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

// ------------------------------------------------------------
// 嵌套组件 children 交替更新（来源 test/translations-accumulate.test.tsx）
// ------------------------------------------------------------
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