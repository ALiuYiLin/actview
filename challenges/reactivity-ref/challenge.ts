// ============================================================
// reactivity-ref — 挑战定义（断言部分：框架保留，勿改）
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'reactivity-ref',
  title: 'ref 基础：创建响应式计数器',
  difficulty: 'easy',
  tags: ['reactivity', 'ref'],
  description: `用 ref 实现 useCounter(initial)，返回 { count: Ref<number>, increment }：
- count 必须是框架的 ref（isRef 为 true，直接改 .value 生效）
- increment() 使 count.value + 1`,
  template: `import { ref } from 'actview'

// 任务：用 ref 实现一个计数器
// useCounter(initial) 返回 { count: Ref<number>, increment: () => void }
// - count 用框架的 ref 创建（响应式）
// - increment() 使 count.value + 1
export function useCounter(initial) {
  // TODO
}`,
  verify(ctx) {
    const { solution, actview, assert } = ctx
    const { useCounter } = solution

    assert.truthy('导出了 useCounter', typeof useCounter === 'function')
    const counter = useCounter(5)

    assert.truthy(
      'count 是框架的 ref',
      actview.isRef(counter.count),
      'count 应是 ref —— 使用 actview 的 ref() 创建，而不是普通对象 { value }'
    )
    assert.equal('初始值', counter.count.value, 5)

    counter.increment()
    assert.equal('increment 后 +1', counter.count.value, 6)

    counter.count.value = 100
    assert.equal('直接修改 count.value 生效', counter.count.value, 100)
  }
})
