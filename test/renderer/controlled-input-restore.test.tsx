// @vitest-environment jsdom
// ============================================================
// 受控还原（restoreControlledState）时序缺陷 —— 回归用例
//
// 历史缺陷（已修复 fa3959c）：
//   旧 patchEvent 在每个事件 handler 后都无条件
//   queueMicrotask(restoreControlledState)。userEvent 输入 'a' 的事件序列
//   （pointerdown→focus→keydown→input）里，前序事件的 restore 裸微任务先
//   入队（此时渲染 flush 尚未入队），input 事件才把 DOM 改成 'a' → 前序
//   restore 用旧受控值（''）把 value 拉回、光标归 0 → 之后渲染才设回 'a'，
//   jsdom 中 selection 截断 → 逐字符输入错乱（'pa'→'ppa'→'ppla'）。
//   修复：restore 只挂 input/change 事件，且用 nextTick 延迟到渲染提交后。
//
// 用例分工：
//   - A/B：手动派发 input 事件，验证逐字符输入顺序与光标保位。
//   - D：userEvent 复现完整事件链（pointerdown→focus→keydown→input）。
//
// ⚠️ 本文件用 jsdom 环境：缺陷症状依赖「设置 input.value 后 selection
//   truncation」的浏览器行为（jsdom 与真实浏览器一致，happy-dom 会掩盖）。
//
// 运行：pnpm exec vitest run test/renderer/controlled-input-restore.test.tsx
//   —— 期望：3 个用例全部通过。
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive } from 'actview'
import userEvent from '@testing-library/user-event'

function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'cir-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

/** 模拟 userEvent.type 的单字符输入：光标处插入 + 派发 input 事件 */
function typeChar(input: HTMLInputElement, ch: string) {
  input.focus()
  const pos = input.selectionStart ?? input.value.length
  input.value = input.value.slice(0, pos) + ch + input.value.slice(pos)
  input.setSelectionRange(pos + 1, pos + 1)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * 等渲染 job + 还原都跑完。
 * ⚠️ 不能用 `nextTick()`：actview 的 nextTick 会先 flush 渲染 job（渲染先于
 * restore 执行），把缺陷时序掩盖掉。userEvent/真实浏览器的输入事件链在
 * input 事件后只 await 裸微任务——restore（input 事件处理器内先入队）会先于
 * 渲染 job 执行，这正是缺陷触发的顺序。
 */
async function settle() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('受控 input 逐字符输入（还原时序）', () => {
  it('A：单字符输入后光标应保持在末尾（还原不得重置光标）', async () => {
    const state = reactive({ text: '' })
    function App() {
      return (
        <input
          class="t"
          value={state.text}
          oninput={(e: any) => { state.text = e.target.value }}
        />
      )
    }
    const host = mount(App)
    const input = host.children[0] as HTMLInputElement
    expect(input.value).toBe('')

    typeChar(input, 'a')
    await settle()

    expect(input.value).toBe('a')
    // 受控语义（React 对齐）：用户输入 'a' 与 state 'a' 一致 → 不拉回 → 光标保位
    expect(input.selectionStart).toBe(1)
  })

  it('B：连续输入 "ap" 应保持输入顺序（光标被重置会变成 "pa"）', async () => {
    const state = reactive({ text: '' })
    function App() {
      return (
        <input
          class="t"
          value={state.text}
          oninput={(e: any) => { state.text = e.target.value }}
        />
      )
    }
    const host = mount(App)
    const input = host.children[0] as HTMLInputElement

    typeChar(input, 'a')
    await settle()
    typeChar(input, 'p')
    await settle()

    expect(input.value).toBe('ap')
    expect(input.selectionStart).toBe(2)
  })

  it('D（userEvent 复现）：连续输入 "appl" 应保持输入顺序', async () => {
    const state = reactive({ text: '' })
    function App() {
      return (
        <input
          class="t"
          value={state.text}
          oninput={(e: any) => { state.text = e.target.value }}
        />
      )
    }
    const host = mount(App)
    const input = host.children[0] as HTMLInputElement
    input.focus()

    const user = userEvent.setup()
    await user.keyboard('appl')

    // 与 React 对齐的受控语义：用户逐字符输入应保持顺序（'appl'）。
    // 缺陷表现：restore 先于渲染 job 把 value 拉回旧值，光标被重置到 0，
    // 后续字符插到开头 → 'ppla'。
    expect(input.value).toBe('appl')
    expect(input.selectionStart).toBe(4)
  })
})
