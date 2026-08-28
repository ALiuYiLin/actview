// ============================================================
// Reactive<T> / ShallowReactive<T> 类型验收（编译期 + 运行时冒烟）
//   1. reactive() 返回值带品牌但结构兼容 T：深层属性访问/展开/传原始形参零成本
//   2. 品牌是「正向标记」（?: true）：raw 仍可赋给 Reactive 形参——
//      表达「工厂产出什么」而非严格闸门（对齐 Vue 3 结构透明哲学）
//   3. 反向断言：标记键可能为 undefined（@ts-expect-error 验证可选性确实生效）
// 运行：pnpm exec vitest run test/types/reactive-types.test.tsx
// 纯类型检查：pnpm exec tsc -p test/tsconfig.json --noEmit
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  computed,
  reactive,
  shallowReactive,
  toRaw,
  isReactive,
  ref,
  watch,
  type Reactive,
  type ShallowReactive,
  type RefFactory,
  type ReactiveFactory,
  type ComputedFactory,
  type WatchFactory
} from 'actview'

interface User {
  name: string
  tags: string[]
}
interface State {
  user: User
  n: number
}

/** 「要求响应式」的形参——调用点签名即契约说明 */
function requiresReactive(_s: Reactive<State>) {
  return 'ok'
}
function requiresShallow(_s: ShallowReactive<{ a: number }>) {
  return 'ok'
}

describe('Reactive / ShallowReactive 类型', () => {
  it('返回值保留深层结构类型 + 可当原始对象用（extends T 向下兼容）', () => {
    const s = reactive<State>({ user: { name: 'a', tags: ['x'] }, n: 1 })

    // 深层访问类型不丢：tsc 下 s.user.name 为 string、s.user.tags 为 string[]
    const name: string = s.user.name
    const tags: string[] = s.user.tags
    expect(name).toBe('a')
    expect(tags).toEqual(['x'])

    // 直接赋给「收原始 State」的形参：Reactive<State> extends State，零迁移成本
    function takesPlain(p: State) {
      return p.n
    }
    expect(takesPlain(s)).toBe(1)

    // @ts-expect-error 不存在的属性仍会被抓出（T 结构完整保留）
    expect(s.nonexistent).toBeUndefined()
  })

  it('品牌是正向标记：raw 也兼容 Reactive 形参（?: true 不破坏 assignability）', () => {
    const raw: State = { user: { name: 'b', tags: [] }, n: 2 }
    // 设计如此：这不是严格闸门，原始对象同样通过——
    // 若未来需要硬闸门（禁 raw），应改用 unique symbol 品牌 + toRaw 逃生口
    expect(requiresReactive(raw)).toBe('ok')
    expect(requiresReactive(reactive(raw))).toBe('ok')

    // 标记键存在且为 true。可选性（true | undefined）仅在 strictNullChecks 下
    // 可被 @ts-expect-error 反向断言；本仓库 tsconfig 未开 strict，
    // undefined 从联合中坍缩，此处仅运行时断言。
    const s = reactive(raw)
    expect(s['__v_isReactive']).toBe(true)
  })

  it('shallowReactive 同理：ShallowReactive<T> 且与 Reactive 相互结构兼容', () => {
    const sr = shallowReactive({ a: 1 })
    const v: number = sr.a
    expect(v).toBe(1)
    expect(requiresShallow({ a: 5 })).toBe('ok') // raw 兼容
    expect(requiresShallow(sr)).toBe('ok')
  })

  it('工厂函数类型（typeof ref 等）：作为形参注入后照常工作', async () => {
    // 工厂注入:测试替身/高阶封装可以把「创建响应式对象的能力」整体替换
    function makePair(create: RefFactory<number>, toReactive: ReactiveFactory) {
      const n = create(1)
      const s = toReactive({ n: n.value })
      return { n, s }
    }
    const { n, s } = makePair(ref, reactive)
    expect(n.value).toBe(1)
    expect(s.n).toBe(1)

    // computed/watch 工厂同理（重载签名随 typeof 完整保留）
    const makeDouble: ComputedFactory = computed
    const c = makeDouble(() => 2)
    expect(c.value).toBe(2)

    let ran = false
    const makeWatch: WatchFactory = watch
    const probe = ref(0)
    makeWatch(probe, () => (ran = true))
    probe.value = 1
    await new Promise((r) => setTimeout(r, 0))
    expect(ran).toBe(true)
  })

  it('运行时冒烟：isReactive/toRaw 语义不受签名改动影响', () => {
    const raw = { a: { b: 1 } }
    const p = reactive(raw)
    expect(isReactive(p)).toBe(true)
    expect(isReactive(raw)).toBe(false)
    expect(toRaw(p)).toBe(raw)
    expect(p.a.b).toBe(1)
  })
})
