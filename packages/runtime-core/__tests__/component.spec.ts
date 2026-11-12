// ============================================================
// isComponent / isClassComponent 运行时契约（第一版类组件）
//
//   - 类组件必须由 @Component 写入 __actview_class_component 标记；
//   - isComponent 只认这个标记（不再接受函数组件）；
//   - 普通 class / 函数 / 对象 / 带错 marker 的对象均不是组件。
// ============================================================

import { describe, expect, it } from 'vitest'
import { isClassComponent, isComponent } from '../src/index'

function markedClass(name = 'Marked') {
  class Comp {
    render() {
      return null
    }
  }
  Object.defineProperty(Comp, '__actview_class_component', {
    value: true,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  Object.defineProperty(Comp, 'name', { value: name, configurable: true })
  return Comp
}

describe('isClassComponent / isComponent', () => {
  it('正例：带 __actview_class_component 标记的 class', () => {
    const Comp = markedClass()
    expect(isClassComponent(Comp)).toBe(true)
    expect(isComponent(Comp)).toBe(true)
  })

  it('反例：裸 class（没有 @Component 标记）', () => {
    class Bare {
      render() {
        return null
      }
    }
    expect(isClassComponent(Bare)).toBe(false)
    expect(isComponent(Bare)).toBe(false)
  })

  it('反例：普通函数 / 对象 / 空值 / 函数 marker 不再有效', () => {
    const fn = Object.assign(() => null, { __actview_component: true as const })
    expect(isComponent(fn)).toBe(false)
    expect(isComponent({})).toBe(false)
    expect(isComponent({ __actview_class_component: true })).toBe(false)
    expect(isComponent([])).toBe(false)
    expect(isComponent('component')).toBe(false)
    expect(isComponent(1)).toBe(false)
    expect(isComponent(null)).toBe(false)
    expect(isComponent(undefined)).toBe(false)
  })
})
