// ============================================================
// JSX props 自动解包（类型层，编译期验证）
//   ts-expect-error 反向断言：若下一行没有类型错误，tsc 会报
//   "Unused @ts-expect-error directive" → 编译失败（同 generics.test.tsx）
// 运行：pnpm exec vitest run test/types/props-unwrap-types.test.tsx（运行时）
//       pnpm typecheck（编译期断言）
// ============================================================

import { describe, it, expect } from 'vitest'
import { ref, computed } from 'actview'

describe('JSX props 自动解包（类型层）', () => {
  it('children 顶层接受 ref（<div>{text}</div>）', () => {
    const text = ref('hello')
    const el = <div>{text}</div>
    expect(el).toBeTruthy()
    // 值形态仍合法
    const plain = <div>hi</div>
    expect(plain).toBeTruthy()
  })

  it('组件 props 接受 Ref：count: number → number | Ref<number>', () => {
    function Child(props: { count: number }) {
      return <span>{props.count}</span>
    }
    const count = ref(1)
    const el = <Child count={count} />
    expect(el).toBeTruthy()
    // 值形态仍合法
    const el2 = <Child count={2} />
    expect(el2).toBeTruthy()
  })

  it('computedRef 同样接受（依赖链解包）', () => {
    function Child(props: { n: number }) {
      return <span>{props.n}</span>
    }
    const base = ref(2)
    const doubled = computed(() => base.value * 2)
    const el = <Child n={doubled} />
    expect(el).toBeTruthy()
  })

  it('原生元素属性接受 ref（<input value={ref} />）', () => {
    const value = ref('a')
    const el = <input value={value} />
    expect(el).toBeTruthy()
    const plain = <input value="plain" />
    expect(plain).toBeTruthy()
  })

  it('ref 键仍是模板引用（类型不变）', () => {
    const inputRef = ref<HTMLInputElement | null>(null)
    const el = <input ref={inputRef} />
    expect(el).toBeTruthy()
  })

  it('错误类型仍被拦截', () => {
    function Child(props: { count: number }) {
      return <span>{props.count}</span>
    }
    // 字符串不是 number，也不是 Ref<number>
    // @ts-expect-error count 应为 number
    const bad1 = <Child count="x" />
    expect(bad1).toBeTruthy()
    // Ref<string> 不能赋给 Ref<number>（Ref 协变检查 value 类型）
    // @ts-expect-error Ref<string> 不匹配 number | Ref<number>
    const bad2 = <Child count={ref('x')} />
    expect(bad2).toBeTruthy()
    // @ts-expect-error 未声明属性仍报错
    const bad3 = <Child extra="x" />
    expect(bad3).toBeTruthy()
  })

  it('数组内 ref 被拒绝（运行时只解包顶层，编译期拦截）', () => {
    const text = ref('x')
    // @ts-expect-error 数组内 ref 运行时不解包
    const bad = <div>{[text]}</div>
    expect(bad).toBeTruthy()
  })

  it('嵌套对象内 ref 被拒绝（MaybeRefProps 只映射顶层）', () => {
    function Child(props: { user: { name: string } }) {
      return <span>{props.user.name}</span>
    }
    // 顶层 ref 可以：{ user: Ref<{name}> }
    const userRef = ref({ name: 'a' })
    const ok = <Child user={userRef} />
    expect(ok).toBeTruthy()
    // 嵌套对象内的 ref 不解包 → 拒绝
    // @ts-expect-error user.name 不接受 Ref
    const bad = <Child user={{ name: ref('b') }} />
    expect(bad).toBeTruthy()
  })
})
