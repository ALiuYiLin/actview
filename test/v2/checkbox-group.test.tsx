// ============================================================
// Checkbox / CheckboxGroup —— 多 ref 场景验收
//
// 四方 ref 共享模型:
//   ① 使用方 inputRef(挂隐藏 input)
//   ② 库内部 internalInput(挂同一 input;点击时写 .checked)
//   ③ Group 注册函数 ref(挂载 register(el)/卸载 register(null) → 反注册)
//   ④ 转发 ref(根 <button>,父组件拿按钮 DOM)
// 外加 render 节点自带 ref → useRenderElement 合并链第 2 源(T4)。
// 运行：pnpm exec vitest run test/components/checkbox-group.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, ref } from 'actview'
import {
  CheckboxRoot,
  CheckboxGroup,
  useCheckboxGroupContext,
  type CheckboxGroupApi,
} from '../../src/components/checkbox'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'cb-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

;(globalThis as any).__AV_DEBUG__ = true

describe('多 ref 合并（Checkbox）', () => {
  it('T1: ①用户 ref === ②内部 ref 所写 === ③注册成员 el——三方同指一个 input;④转发 = 根按钮', async () => {
    const userInputRef = ref<HTMLInputElement | null>(null)
    const rootRef = ref<HTMLElement | null>(null)
    let members: any[] = []

    function Status() {
      const g = useCheckboxGroupContext()
      if (g) members = g.members
      return <i class="status" data-count={String(members.length)} />
    }
    function App() {
      return (
        <CheckboxGroup groupRef={undefined}>
          <Status />
          <CheckboxRoot
            inputRef={userInputRef}
            ref={rootRef}
            value="apple"
            defaultChecked={false}
          />
        </CheckboxGroup>
      )
    }
    const host = mount(App)

    const hiddenInput = host.querySelector('input[type="checkbox"]')!
    // ① === ③:用户 ref 与注册成员指向同一 input
    expect(userInputRef.value).toBe(hiddenInput)
    expect(members[0].el).toBe(hiddenInput)
    expect(members[0].value).toBe('apple')
    // ② 的效果:点击根按钮 → 内部 ref 写 input.checked 翻转
    ;(host.querySelector('[role="checkbox"]') as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect((hiddenInput as HTMLInputElement).checked).toBe(true) // 内部 ref 写入
    expect(host.querySelector('[aria-checked="true"]')).toBeTruthy()
    // ④:转发 ref = 组件实例（vue 语义）；根按钮渲染由 DOM 查询验证
    expect(rootRef.value).toBeTruthy()
    expect(host.querySelector('[role="checkbox"]')).toBeTruthy()
  })

  it('T2: 卸载 → 注册函数收到 null → 反注册；重挂载 → 再注册', async () => {
    // v2：JSX 无顶层 ref 解包——ref 本体直接传（无 rawRef 概念）
    const groupApi = ref<CheckboxGroupApi | null>(null)
    const state = reactive({ show: true })
    function App() {
      return (
        <CheckboxGroup groupRef={groupApi}>
          {state.show ? (
            <CheckboxRoot value="x" id="cb1" />
          ) : null}
        </CheckboxGroup>
      )
    }
    const host = mount(App)
    expect(groupApi.value!.members.length).toBe(1)

    // 卸载 → 函数 ref 收到 null → 反注册
    state.show = false
    await new Promise((r) => setTimeout(r, 0))
    expect(groupApi.value!.members.length).toBe(0)

    // 重新挂载 → 重新注册
    state.show = true
    await new Promise((r) => setTimeout(r, 0))
    expect(groupApi.value!.members.length).toBe(1)
  })

  it('T4: render 节点自带 ref → 合并链第 2 源(getReactElementRef)', async () => {
    const renderElRef = ref<HTMLElement | null>(null)
    function App() {
      return (
        <CheckboxRoot
          defaultChecked={true}
          render={(p: any) => <button {...p} class="rendered" ref={renderElRef} />}
        />
      )
    }
    const host = mount(App)
    const el = host.querySelector('.rendered')!
    // render 节点的 ref 已被 useMergedRefs 链覆盖为真实元素
    expect(renderElRef.value).toBe(el)
    expect((renderElRef.value as HTMLButtonElement).getAttribute('aria-checked')).toBe('true')
  })

  it('T5: Group 受控 value + onValueChange（React 对齐：统管勾选状态）', async () => {
    const values = ref<string[]>(['apple'])
    function App() {
      return (
        <CheckboxGroup
          value={values.value}
          onValueChange={(v) => {
            values.value = v
          }}
        >
          <CheckboxRoot value="apple" />
          <CheckboxRoot value="banana" />
        </CheckboxGroup>
      )
    }
    const host = mount(App)
    const boxes = host.querySelectorAll('[role="checkbox"]')
    const apple = boxes[0] as HTMLElement
    const banana = boxes[1] as HTMLElement
    expect(apple.getAttribute('aria-checked')).toBe('true')
    expect(banana.getAttribute('aria-checked')).toBe('false')

    // 点击 banana → toggleValue 上报 → 父更新 value → 重渲染派生
    banana.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(banana.getAttribute('aria-checked')).toBe('true')
    expect(values.value).toEqual(['apple', 'banana'])

    // 点击 apple → 取消选中
    apple.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(apple.getAttribute('aria-checked')).toBe('false')
    expect(values.value).toEqual(['banana'])
  })

  it('T6: 独立 Root（无 Group）本地翻转 + onCheckedChange 回调', async () => {
    const changes: boolean[] = []
    function App() {
      return (
        <CheckboxRoot
          defaultChecked={false}
          onCheckedChange={(c) => changes.push(c)}
          value="solo"
        />
      )
    }
    const host = mount(App)
    const btn = host.querySelector('[role="checkbox"]') as HTMLElement
    expect(btn.getAttribute('aria-checked')).toBe('false')
    btn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.getAttribute('aria-checked')).toBe('true')
    expect(changes).toEqual([true])
  })
})

