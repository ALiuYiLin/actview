// ============================================================
// ActView Reactivity 最小示例
//   点击按钮 → count.value++ → effect 自动把新值写回 DOM
//   （无 UI 框架参与：ref / computed / effect 直接驱动原生 DOM）
//
// 编译期（@actview/compiler，见 docs/compiler-layers.md）：
//   - 小写函数 main：不是组件，只做 L2 JSX 降级
//   - 大写函数 Counter：L1 包装为 defineComponent(setup)，带
//     __actview_component 标记
// ============================================================

import { ref } from '@actview/reactivity'

const main = () => (
  <main class="demo">
    <h1>ActView · Reactivity</h1>
    <p class="row"><span>count</span><strong data-count>0</strong></p>
    <p class="row"><span>double（computed）</span><strong data-double>0</strong></p>
    <button type="button" data-inc>count + 1</button>
  </main>
)
console.log('main: ', main)

function Counter() {
  const count = ref(1)
  return (
    <>
      <button>{count.value}</button>
    </>
  )
}
console.log('Counter is component?', (Counter as any).__actview_component === true)
