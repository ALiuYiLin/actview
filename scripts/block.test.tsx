// ============================================================
// block tree（C 方案）测试
// 1. jsxFactory：openBlock/setupBlock 收集动态节点（静态不收集、v-memo 根不收集自己）
// 2. 运行时：v-memo 行 patch 时只遍历 __dynamicChildren（静态骨架零 DOM 变更）
// 运行：pnpm test scripts/block.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, nextTick } from '@actview/core'
import { jsx, openBlock, setupBlock } from '@actview/jsx'

describe('block tree：jsxFactory 动态节点收集', () => {
  it('openBlock/setupBlock：动态节点（flag≠0）收集，静态（flag=0）不收集', () => {
    openBlock()
    const dynText = jsx('td', {}, null, 1, undefined, 'x')        // PATCH_TEXT
    const dynProps = jsx('a', { onClick: () => {} }, null, 2, ['onClick'], 'y') // PATCH_PROPS
    const stat = jsx('td', { class: 'a' }, null, 0, undefined, 'z') // 静态 props
    const root = setupBlock(jsx('div', {}, null, 0, undefined, [dynText, dynProps, stat]))

    expect(root.__dynamicChildren).toEqual([dynText, dynProps])
    expect(root.__dynamicChildren).not.toContain(stat)
  })

  it('v-memo 根不收集自己（避免收集到自身 block）', () => {
    openBlock()
    const child = jsx('td', {}, null, 1, undefined, 'x')
    const tr = setupBlock(jsx('tr', {}, null, 2, ['class'], [child], () => [1]))
    // tr 有 memoDeps → 不 push 自身；child 正常收集
    expect(tr.__dynamicChildren).toEqual([child])
  })

  it('嵌套 block：内层 setupBlock 弹出后外层继续收集', () => {
    openBlock() // 外层
    openBlock() // 内层（v-memo 元素）
    const innerChild = jsx('td', {}, null, 1, undefined, 'i')
    const inner = setupBlock(jsx('tr', {}, null, 2, ['class'], [innerChild], () => [1]))
    const outerStat = jsx('span', { class: 's' }, null, 0, undefined, 'o') // 静态不收集
    const outerDyn = jsx('b', {}, null, 1, undefined, 'd')
    const outer = setupBlock(jsx('div', {}, null, 0, undefined, [inner, outerStat, outerDyn]))

    // 内层 block 的节点归内层；外层只收集自己的动态节点
    expect(inner.__dynamicChildren).toEqual([innerChild])
    expect(outer.__dynamicChildren).toEqual([outerDyn])
  })
})

describe('block tree：v-memo 行 patch 走动态节点', () => {
  it('label 更新时：静态骨架（td.col-md-6）零 DOM 变更，动态节点更新', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ])
    const sel = ref<number | null>(null)
    const App = () => (
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} v-memo={[r.label, r.id === sel.value]}>
              <td class="col-md-1">{r.id}</td>
              <td class="col-md-4">{r.label}</td>
              <td class="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    )
    const host = document.createElement('div')
    host.id = 'block-' + Math.random().toString(36).slice(2)
    document.body.appendChild(host)
    createApp(App).mount('#' + host.id)

    const statTd = host.querySelectorAll('tr')[0].children[2] // 静态空 td
    let statMutations = 0
    const obs = new MutationObserver(() => statMutations++)
    obs.observe(statTd, { characterData: true, childList: true, attributes: true, subtree: true })

    rows[0].label = 'a!!!'
    await nextTick()

    expect(host.querySelectorAll('.col-md-4')[0].textContent).toBe('a!!!')
    expect(statMutations).toBe(0) // 静态骨架 td 零变更（block 只 patch 动态节点）
    obs.disconnect()
  })
})
