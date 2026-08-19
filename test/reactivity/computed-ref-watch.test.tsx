// ============================================================
// computed / ref / watch 联合测试（拆分自 verify.test.tsx）
// 运行：pnpm exec vitest run test/reactivity/computed-ref-watch.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { reactive, ref, computed, watch, nextTick, createApp } from 'actview'

/** 创建带 id 的宿主元素并挂载组件——拆分自 verify.test.tsx L15-21 */
function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

/** 收集元素文本（含文本节点）——拆分自 verify.test.tsx L24-28 */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 以下 describe 拷贝自 verify.test.tsx — 场景 13：computed / ref / watch（L658-716，1 用例）
// ------------------------------------------------------------
describe('场景 13：computed / ref / watch', () => {
  it('computed 缓存 + ref 响应式 + watch 回调与 cleanup', async () => {
    const state = reactive({ count: 1 })
    const double = computed(() => state.count * 2)
    const countRef = ref(0)
    const watchLog: string[] = []
    let cleanupRan = false

    watch(() => state.count, (n, o) => watchLog.push(`count:${o}->${n}`))
    watch(
      countRef,
      (n, o, onCleanup) => {
        onCleanup(() => {
          cleanupRan = true
        })
        watchLog.push(`ref:${o}->${n}`)
      },
      { immediate: true },
    )

    function App() {
      return (
        <div>
          <span>double:{double.value}</span>
          <span>ref:{countRef.value}</span>
        </div>
      )
    }
    const host = mount('#s13', App)
    expect(collectText(host)).toContain('double:2')
    expect(collectText(host)).toContain('ref:0')
    expect(watchLog).toEqual(['ref:undefined->0']) // immediate 首次触发

    state.count = 3
    countRef.value = 5
    await nextTick()
    expect(collectText(host)).toContain('double:6')
    expect(collectText(host)).toContain('ref:5')
    await nextTick() // watch 独立微任务，等其跑完
    expect(watchLog).toEqual([
      'ref:undefined->0',
      'count:1->3',
      'ref:0->5',
    ])

    // cleanup：下一次触发前执行上一次注册的清理
    cleanupRan = false
    countRef.value = 9
    await nextTick()
    await nextTick()
    expect(cleanupRan).toBe(true)
    expect(watchLog).toEqual([
      'ref:undefined->0',
      'count:1->3',
      'ref:0->5',
      'ref:5->9',
    ])
  })
})