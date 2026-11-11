// ============================================================
// defineComponent / isComponent 运行时契约
//
//   - defineComponent(setup, name?) 返回同一个 setup 函数对象（不包装成 { __setup }）
//   - 函数上写入 __actview_component: true 标记（可枚举 false / 不可写 / 可配置）
//   - name 传入时改写函数 name；重复调用幂等
//   - setup(props, ctx) 仍可直接调用并返回 render 函数
//   - isComponent：只有「函数 + 标记」为真（普通函数 / 对象 / 带标记对象为假）
// ============================================================

import { describe, expect, it } from 'vitest'
import { createElement, defineComponent, isComponent } from '../src/index'
import type { Element, SetupContext } from '../src/index'

type Props = { start: number }
type Setup = (props: Props, ctx: SetupContext) => () => Element | null

/** 每个用例用独立的 setup 函数，避免 defineComponent 的标记串场 */
function makeSetup(): Setup {
  return (props) => () => createElement('span', { start: props.start })
}

describe('defineComponent', () => {
  it('返回同一个 setup 函数对象（不产生 { __setup } 包装对象）', () => {
    const setup = makeSetup()
    const Comp = defineComponent(setup)
    expect(Comp).toBe(setup)
    // 不再是旧实现的 { __setup }：产物本身可调用
    expect(typeof Comp).toBe('function')
    expect((Comp as unknown as { __setup?: unknown }).__setup).toBeUndefined()
  })

  it('写入 __actview_component: true 标记（non-enumerable / non-writable / configurable）', () => {
    const Comp = defineComponent(makeSetup())
    expect((Comp as unknown as { __actview_component?: unknown }).__actview_component).toBe(true)

    const descriptor = Object.getOwnPropertyDescriptor(Comp, '__actview_component')
    expect(descriptor).toMatchObject({
      value: true,
      enumerable: false,
      writable: false,
      configurable: true,
    })
    // 标记不出现在可枚举键里（不会污染 props / spread / JSON）
    expect(Object.keys(Comp)).not.toContain('__actview_component')
  })

  it('未传 name 时保留函数原 name；传入 name 时改写函数 name', () => {
    function named(props: Props): Element | null {
      return createElement('span', { start: props.start })
    }

    const unnamed = defineComponent(named)
    expect(unnamed.name).toBe('named')

    const namedComp = defineComponent(named, 'Counter')
    expect(namedComp).toBe(named)
    expect(namedComp.name).toBe('Counter')
    expect(Object.getOwnPropertyDescriptor(namedComp, 'name')).toMatchObject({
      value: 'Counter',
      configurable: true,
    })
  })

  it('setup(props, ctx) 仍可调用并返回 render 函数', () => {
    const calls: string[] = []
    const Comp = defineComponent((props: Props, ctx: SetupContext) => {
      calls.push('setup')
      return () => createElement('span', { start: props.start, from: ctx.injects.from })
    })

    const ctx: SetupContext = { injects: { from: 'parent' } }
    const render = Comp({ start: 7 }, ctx)
    expect(calls).toEqual(['setup'])
    expect(typeof render).toBe('function')

    const element = render()
    expect(element?.type).toBe('span')
    expect(element?.props).toEqual({ start: 7, from: 'parent' })
  })

  it('重复调用幂等：返回同一函数、不抛错、标记与 name 保持', () => {
    const setup = makeSetup()
    const first = defineComponent(setup, 'Counter')
    const second = defineComponent(first, 'Counter')

    expect(second).toBe(setup)
    expect(second).toBe(first)
    expect((second as unknown as { __actview_component?: unknown }).__actview_component).toBe(true)
    expect(second.name).toBe('Counter')

    // 标记 / name 均 configurable：再定义（含改 name）不报错
    expect(() => defineComponent(first, 'Counter')).not.toThrow()
    expect(() => defineComponent(first, 'Renamed')).not.toThrow()
    expect(first.name).toBe('Renamed')
  })
})

describe('isComponent', () => {
  it('正例：defineComponent 产物', () => {
    expect(isComponent(defineComponent(makeSetup()))).toBe(true)
    expect(isComponent(defineComponent(makeSetup(), 'Named'))).toBe(true)
  })

  it('正例：函数 + 标记（marker 是判定依据）', () => {
    const manual = Object.assign(
      function manualSetup() {
        return () => null
      },
      { __actview_component: true as const },
    )
    expect(isComponent(manual)).toBe(true)
  })

  it('反例：普通函数 / 对象 / 带 marker 的对象 / 空值', () => {
    // 每个用例独立函数：避免被 defineComponent 提前标记
    const plain = makeSetup()
    expect(isComponent(plain)).toBe(false)
    expect(isComponent(() => null)).toBe(false)
    expect(isComponent(function NotMarked() {})).toBe(false)
    expect(isComponent({})).toBe(false)
    expect(isComponent({ __actview_component: true })).toBe(false)
    expect(isComponent([])).toBe(false)
    expect(isComponent('component')).toBe(false)
    expect(isComponent(1)).toBe(false)
    expect(isComponent(null)).toBe(false)
    expect(isComponent(undefined)).toBe(false)
  })
})
