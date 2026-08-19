// ============================================================
// effect 基础测试（拆分自 actview.test.tsx + verify.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/effect.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, createApp } from 'actview'
import { runEffect } from '@actview/core'

/** 收集元素文本（含文本节点）—— 拆分自 verify.test.tsx L24-28 */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 以下 it 块拷贝自 actview.test.tsx — 迁移：effect 基础（L19-187，14 用例）
// ------------------------------------------------------------
describe('迁移：effect 基础', () => {
  it('should run the passed function once', () => {
    let count = 0
    runEffect(() => count++)
    expect(count).toBe(1)
  })

  it('should observe basic properties', () => {
    let dummy: any
    const counter = reactive({ num: 0 })
    runEffect(() => (dummy = counter.num))
    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
  })

  it('should observe multiple properties', () => {
    let dummy: any
    const counter = reactive({ num1: 0, num2: 0 })
    runEffect(() => (dummy = counter.num1 + counter.num1 + counter.num2))
    expect(dummy).toBe(0)
    counter.num1 = counter.num2 = 7
    expect(dummy).toBe(21)
  })

  it('should handle multiple effects', () => {
    let dummy1: any, dummy2: any
    const counter = reactive({ num: 0 })
    runEffect(() => (dummy1 = counter.num))
    runEffect(() => (dummy2 = counter.num))
    expect(dummy1).toBe(0)
    expect(dummy2).toBe(0)
    counter.num++
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
  })

  it('should observe nested properties', () => {
    let dummy: any
    const counter = reactive({ nested: { num: 0 } })
    runEffect(() => (dummy = counter.nested.num))
    expect(dummy).toBe(0)
    counter.nested.num = 8
    expect(dummy).toBe(8)
  })

  it('should observe delete operations', () => {
    let dummy: any
    const obj = reactive<{ prop?: string }>({ prop: 'value' })
    runEffect(() => (dummy = obj.prop))
    expect(dummy).toBe('value')
    delete obj.prop
    expect(dummy).toBe(undefined)
  })

  it('should observe has operations', () => {
    let dummy: any
    const obj = reactive<{ prop?: string | number }>({ prop: 'value' })
    runEffect(() => (dummy = 'prop' in obj))
    expect(dummy).toBe(true)
    delete obj.prop
    expect(dummy).toBe(false)
    obj.prop = 12
    expect(dummy).toBe(true)
  })

  it('should observe properties on the prototype chain', () => {
    let dummy: any
    const counter = reactive<{ num?: number }>({ num: 0 })
    const parentCounter = reactive({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    runEffect(() => (dummy = counter.num))
    expect(dummy).toBe(0)
    delete counter.num
    expect(dummy).toBe(2)
    parentCounter.num = 4
    expect(dummy).toBe(4)
    counter.num = 3
    expect(dummy).toBe(3)
  })

  it('should observe has operations on the prototype chain', () => {
    let dummy: any
    const counter = reactive<{ num?: number }>({ num: 0 })
    const parentCounter = reactive<{ num?: number }>({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    runEffect(() => (dummy = 'num' in counter))
    expect(dummy).toBe(true)
    delete counter.num
    expect(dummy).toBe(true)
    parentCounter.num = 4
    expect(dummy).toBe(true)
  })

  it('should not trigger if value did not change', () => {
    let dummy: any
    let runs = 0
    const obj = reactive<{ a?: number; b?: number }>({ a: 1, b: 2 })
    const effect = runEffect(() => {
      runs++
      dummy = obj.a
    })
    expect(dummy).toBe(1)
    obj.b = 3
    expect(runs).toBe(1)
    expect(dummy).toBe(1)
    effect.stop()
  })

  it('should discover new branches while running', () => {
    let dummy: any
    let run = 0
    const obj = reactive<{ prop?: string; run?: boolean }>({ prop: 'value', run: false })
    const conditional = () => (obj.run ? obj.prop : 'other')
    runEffect(() => {
      dummy = conditional()
      run++
    })
    expect(dummy).toBe('other')
    obj.prop = 'value2'
    expect(run).toBe(1) // prop 未读（run=false 分支），不触发
    expect(dummy).toBe('other')
    obj.run = true
    expect(run).toBe(2)
    expect(dummy).toBe('value2')
    obj.prop = 'value3'
    expect(run).toBe(3)
    expect(dummy).toBe('value3')
  })

  it('should not be triggered by child effects', () => {
    let dummy: any
    const obj = reactive({ a: 1, b: 2 })
    const parentEffect = runEffect(() => {
      dummy = obj.a
      runEffect(() => {
        obj.b // 子 effect 读 b
      })
    })
    obj.b = 3 // 只触发子 effect，不触发父
    expect(dummy).toBe(1)
    parentEffect.stop()
  })

  it('should stop the effect', () => {
    let dummy: any
    const obj = reactive({ prop: 1 })
    const effect = runEffect(() => (dummy = obj.prop))
    expect(dummy).toBe(1)
    effect.stop()
    obj.prop = 2
    expect(dummy).toBe(1)
  })

  it('should cleanup dependencies on re-run (stale dep not triggered)', () => {
    let dummy: any
    const obj = reactive<{ ok?: boolean; count?: number }>({ ok: true, count: 0 })
    const effect = runEffect(() => {
      dummy = obj.ok ? obj.count : 0
    })
    expect(dummy).toBe(0)
    obj.ok = false // 切换分支：count 依赖被清理
    obj.count = 5
    expect(dummy).toBe(0) // count 不再触发
    obj.ok = true
    expect(dummy).toBe(5)
    effect.stop()
  })
})

// ------------------------------------------------------------
// 以下 it 块拷贝自 verify.test.tsx — 场景 17：effect 内修改数组（L957-1010，3 用例）
// ------------------------------------------------------------
describe('场景 17：effect 内修改数组', () => {
  it('runEffect 内 push 自身依赖数组不爆栈、不无限重入', () => {
    const state = reactive({ items: [1] })
    let runs = 0
    const e = runEffect(() => {
      runs++
      state.items.push(state.items.length)
    })
    // 重入保护：修改自身的 effect 不因自身 push 的 trigger 同步重跑
    expect(runs).toBe(1)
    expect(state.items).toEqual([1, 1]) // push 恰好执行一次
    e.stop()
  })

  it('push 的 effect 不重入，其他依赖该数组的 effect 正常触发', () => {
    const state = reactive({ items: [1] })
    const seen: number[][] = []
    const reader = runEffect(() => seen.push(state.items.slice()))
    const pusher = runEffect(() => state.items.push(9))

    expect(state.items).toEqual([1, 9])
    // reader 首次读到 [1]，随后被 push 触发重跑并读到最新 [1,9]
    // （push 内部索引+length 两次 set 会触发多次重跑，但每次都读到最新值）
    expect(seen[0]).toEqual([1])
    expect(seen[seen.length - 1]).toEqual([1, 9])
    // pusher 自身不重入：数组里恰好一个 9
    expect(state.items.filter((i) => i === 9)).toHaveLength(1)

    // 只停 pusher（避免 push(10) 触发它重跑再 push(9)）；reader 保持响应
    pusher.stop()
    state.items.push(10)
    expect(seen[seen.length - 1]).toEqual([1, 9, 10])
    reader.stop()
  })

  it('组件渲染内 push 不导致渲染无限循环', async () => {
    const state = reactive({ items: [1] })
    function App() {
      state.items.push(state.items.length) // 渲染期内 push（反模式，但不应崩）
      return <ul>{state.items.map((i) => <li key={i}>{i}</li>)}</ul>
    }
    const host = document.createElement('div')
    host.id = 's17'
    document.body.appendChild(host)
    createApp(App).mount('#s17')
    expect(collectText(host)).toContain('1')
  })
})