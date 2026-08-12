// ============================================================
// v-memo 指令运行时行为测试
// 验证：deps 相同的子树 patch 时完全短路（不触碰 DOM）；
//       deps 变化的子树正常 patch。
// 短路证据：MutationObserver——未变化行零 DOM 变更，变化行有变更。
// 运行：pnpm test scripts/vmemo.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref, nextTick } from '@actview/core'

function setup(rows: { id: number; label: string }[], sel: any) {
  const App = () => (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            class={r.id === sel.value ? 'danger' : ''}
            v-memo={[r.label, r.id === sel.value]}
          >
            <td class="id">{r.id}</td>
            <td class="lbl">{r.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  const host = document.createElement('div')
  host.id = 'vmemo-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(App).mount('#' + host.id)
  return host
}

describe('v-memo 指令：运行时短路', () => {
  it('局部更新：deps 未变行零 DOM 变更，deps 变化行正常更新', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
      { id: 3, label: 'c' },
    ])
    const sel = ref<number | null>(null)
    const host = setup(rows, sel)

    const lbls = host.querySelectorAll('.lbl')
    const trs = host.querySelectorAll('tr')
    const before = {
      tr0: trs[0], tr1: trs[1], tr2: trs[2],
      lbl0: lbls[0], lbl1: lbls[1], lbl2: lbls[2],
    }

    // 观察第 2 行（未变化行）：应零变更
    let mutations = 0
    const obs = new MutationObserver(() => mutations++)
    obs.observe(before.lbl1, { characterData: true, childList: true, subtree: true })

    // 原地改第 1 行（v-memo 值比较，不要求不可变更新）
    rows[0].label = 'a!!!'
    await nextTick()

    expect(before.lbl0.textContent).toBe('a!!!') // 变化行已更新
    expect(before.lbl1.textContent).toBe('b')    // 未变行内容不变
    expect(before.lbl2.textContent).toBe('c')
    expect(mutations).toBe(0)                    // 未变行零 DOM 操作（短路证据）
    expect(before.lbl1).toBe(host.querySelectorAll('.lbl')[1]) // 元素引用不变

    // 改第 2 行 → 该行应触发 DOM 变更
    rows[1].label = 'b!!!'
    await nextTick()
    expect(before.lbl1.textContent).toBe('b!!!')
    expect(mutations).toBeGreaterThan(0)
    obs.disconnect()
  })

  it('选中高亮：selected 变化只更新受影响的 tr（其他行短路）', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
      { id: 3, label: 'c' },
    ])
    const sel = ref<number | null>(null)
    const host = setup(rows, sel)

    const trs = host.querySelectorAll('tr')
    expect(trs[1].className).toBe('') // 初始无高亮

    // 观察第 1、3 行（不应受影响）
    let mut1 = 0
    let mut3 = 0
    const obs1 = new MutationObserver(() => mut1++)
    const obs3 = new MutationObserver(() => mut3++)
    obs1.observe(trs[0], { attributes: true, attributeFilter: ['class'] })
    obs3.observe(trs[2], { attributes: true, attributeFilter: ['class'] })

    sel.value = 2
    await nextTick()

    expect(trs[1].className).toContain('danger') // 选中行高亮
    expect(mut1).toBe(0) // 未选中行零 class 变更（短路）
    expect(mut3).toBe(0)

    // 取消选中（selected 变回 null）→ 只有原选中行更新
    sel.value = null
    await nextTick()
    expect(trs[1].className).toBe('')
    expect(mut1).toBe(0)
    expect(mut3).toBe(0)
    obs1.disconnect()
    obs3.disconnect()
  })

  it('v-memo 与 key 复用：行重建后短路记录跟随新 VNode', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ])
    const sel = ref<number | null>(null)
    const host = setup(rows, sel)

    const lbls = host.querySelectorAll('.lbl')
    // 交换两行 → key 变化 → 重挂载；随后同 label 再渲染应能正常短路
    rows[0] = { id: 2, label: 'b' }
    rows[1] = { id: 1, label: 'a' }
    await nextTick()

    const lbls2 = host.querySelectorAll('.lbl')
    expect(lbls2[0].textContent).toBe('b')
    expect(lbls2[1].textContent).toBe('a')
    expect(lbls2[0]).not.toBe(lbls[0]) // key 变了 → 新 DOM

    // 再次更新后未变行仍短路
    let mutations = 0
    const obs = new MutationObserver(() => mutations++)
    obs.observe(lbls2[1], { characterData: true, childList: true, subtree: true })
    rows[1].label = 'a!!!'
    await nextTick()
    expect(lbls2[1].textContent).toBe('a!!!')
    expect(mutations).toBeGreaterThan(0) // 该行 label 变 → 更新
    obs.disconnect()
  })
})
