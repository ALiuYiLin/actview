// ============================================================
// reactivity-computed — 挑战定义（断言部分：框架保留，勿改）
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'reactivity-computed',
  title: 'computed 派生值：随依赖自动重算',
  difficulty: 'easy',
  tags: ['reactivity', 'computed'],
  description: `用 computed 实现 useDouble(source: Ref<number>)，返回 Ref<number>：
- 值是 source.value 的两倍
- source 变化后返回值自动更新（响应式派生，不能是快照）`,
  template: `import { ref, computed } from 'actview'

// 任务：useDouble(source) 返回一个 computed ref
// 值是 source.value 的两倍，且随 source 变化自动更新
export function useDouble(source) {
  // TODO
}`,
  verify(ctx) {
    const { solution, actview, assert } = ctx
    const { useDouble } = solution

    assert.truthy('导出了 useDouble', typeof useDouble === 'function')

    const source = actview.ref(2)
    const doubled = useDouble(source)

    assert.truthy(
      '返回的是 ref',
      actview.isRef(doubled),
      '应返回 computed ref —— 使用 actview 的 computed() 创建'
    )
    assert.equal('初始派生值 2×2', doubled.value, 4)

    source.value = 10
    assert.equal(
      '源变化后自动重算 10×2',
      doubled.value,
      20,
      'source 变化后返回值未更新：computed 应随依赖源自动重算，不能一次性求值快照'
    )
  }
})
