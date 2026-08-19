// ============================================================
// 场景 16：类型泛型化（编译期验证）
//   @ts-expect-error 反向断言：若下一行没有类型错误，tsc 会报
//   "Unused @ts-expect-error directive" → 编译失败，
//   从而在编译期验证 JSX props 推导与事件类型检查确实生效
// 拆分自 test/verify.test.tsx
// 运行：pnpm exec vitest run test/types/generics.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'

describe('场景 16：类型泛型化（编译期）', () => {
  it('组件 props 推导 + 事件类型检查', () => {
    function Child(props: { msg: string; onSave?: (v: string) => void }) {
      return <span>{props.msg}</span>
    }

    // 合法用法：msg 类型正确，onSave 回调参数推导为 string
    const ok = <Child msg="hi" onSave={(v) => v.toUpperCase()} />
    expect(ok).toBeTruthy()

    // @ts-expect-error msg 应为 string
    const bad1 = <Child msg={123} />
    expect(bad1).toBeTruthy()

    // @ts-expect-error onSave 参数应为 string
    const bad2 = <Child onSave={(n: number) => n.toFixed()} />
    expect(bad2).toBeTruthy()

    // @ts-expect-error onClick 参数应为 MouseEvent
    const bad3 = <button onClick={(e: number) => {}} />
    expect(bad3).toBeTruthy()

    // 事件参数推导：e 为 MouseEvent（可访问 target）
    const evt = <button onClick={(e) => (e.target as HTMLElement).tagName} />
    expect(evt).toBeTruthy()

    // @ts-expect-error input 的 type 有枚举约束
    const bad4 = <input type={123} />
    expect(bad4).toBeTruthy()

    // 合法：input 专属属性
    const okInput = <input type="checkbox" checked={true} />
    expect(okInput).toBeTruthy()
  })
})