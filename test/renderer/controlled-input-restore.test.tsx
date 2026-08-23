// @vitest-environment jsdom
// ============================================================
// 受控还原（restoreControlledState）时序缺陷复现
// 背景：patchEvent（renderer.ts ~L714）在 input 事件后
//   queueMicrotask(restoreControlledState)，而 handler 内 state 变化
//   触发的渲染 job 也走微任务（Promise.resolve().then(flushJobs)）。
//   若 restore 先于渲染 job 执行 → 拿渲染前旧受控值（''）把用户刚输入的
//   'a' 拉回 ''，随后渲染才设回 'a' → 光标被重置到 0 → 逐字符输入错乱
//   （'pa' → 'ppa' → 'ppla'）。
//
// 触发条件（用例 E，缺陷复现）：
//   - 受控 input 作为「可输入 combobox reference」（useListNavigation 的
//     typeable combobox 场景——input 的 keydown 由 hook 处理）
//   - input 的 value 渲染依赖 computed 链（如搜索过滤列表），使受控值变化
//     的渲染 flush 晚于 restore 的微任务 → restore 先用旧值拉回 → 光标归 0
//   - 用例 A/B/D 是基线：裸受控 input（无 combobox/hook）不触发（jsdom 下
//     通过），证明缺陷不是受控语义本身，而是上面两条组合。
//
// ⚠️ 必须用 jsdom 环境：该缺陷的用户可见症状依赖「设置 input.value 后
//   selection 截断到新值长度内」的浏览器行为（jsdom 与真实浏览器一致）。
//   happy-dom 设置 value 不截断 selection，症状被掩盖，用例会误通过。
//   （vitest 全局环境为 happy-dom，见 vite.config.ts；本文件用
//   @vitest-environment jsdom 覆盖。）
//
// 运行：pnpm exec vitest run test/renderer/controlled-input-restore.test.tsx
//   —— 期望：E 失败（'ppla'），A/B/D 通过。修复 renderer.ts 中
//   restoreControlledState 的执行时机（应晚于受控值渲染提交，对齐 React）
//   后 E 应通过。
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, nextTick, ref, computed, defineComponent } from 'actview'
import userEvent from '@testing-library/user-event'
import {
  useFloating,
  useInteractions,
  useListNavigation,
  FloatingPortal,
} from '@floating-ui/actview'

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

  it('E（缺陷复现）：combobox 受控输入框逐字符输入保持顺序', async () => {
    const emojis = [
      { name: 'apple', emoji: '🍎' },
      { name: 'orange', emoji: '🍊' },
      { name: 'watermelon', emoji: '🍉' },
      { name: 'strawberry', emoji: '🍓' },
      { name: 'pear', emoji: '🍐' },
      { name: 'banana', emoji: '🍌' },
    ]

    const open = ref(true)
    const search = ref('')
    const activeIndex = ref<number | null>(null)
    const listRef = ref<Array<HTMLElement | null>>([])

    const { refs, context } = useFloating({
      open,
      onOpenChange: (o: boolean) => {
        open.value = o
      },
    })

    // input 的 value 渲染依赖 computed 链（过滤列表），受控值变化时渲染
    // flush 晚于 restore 的微任务 → 缺陷触发。
    const filtered = computed(() =>
      emojis.filter(({ name }) => name.includes(search.value)),
    )

    const { getReferenceProps: getInputProps } = useInteractions([
      useListNavigation(context, {
        listRef,
        activeIndex,
        onNavigate: (i: number) => {
          activeIndex.value = i
        },
        orientation: 'horizontal',
        loop: true,
        openOnArrowKeyDown: false,
      }),
    ])

    const App = defineComponent(function () {
      return () => (
        <FloatingPortal>
          {open.value && (
            <div
              ref={refs.setFloating}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <input
                aria-label="search-input"
                value={search.value}
                {...getInputProps({
                  onChange: (e: any) => {
                    activeIndex.value = null
                    search.value = e.target.value
                  },
                })}
              />
              {filtered.value.map(({ name }, i) => (
                <button key={name} role="option" data-index={i}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </FloatingPortal>
      )
    })

    const host = mount(App)
    // FloatingPortal（Teleport to body）：input 在 body 下而非 host 内；
    // 用唯一 aria-label 避免命中同文件其他用例的残留 input
    const input = document.querySelector('[aria-label="search-input"]') as HTMLInputElement
    expect(input).toBeTruthy()
    input.focus()

    const user = userEvent.setup()
    await user.keyboard('appl')

    // 缺陷表现：restore 先于受控值渲染把 value 拉回旧值、光标重置到 0，
    // 逐字符输入错乱 → 'ppla'。修复 restoreControlledState 时序后应为 'appl'。
    expect(input.value).toBe('appl')
    expect(input.selectionStart).toBe(4)
  })
})
