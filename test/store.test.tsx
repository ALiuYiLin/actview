// ============================================================
// @actview/store 状态管理验收测试（vitest + happy-dom）
//   覆盖：defineStore 单例 / 响应式 / 类型推导 / reset / 插件 /
//         组件内 store 状态变化触发更新
// 运行：pnpm test
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { reactive, computed, createApp, nextTick } from 'actview'
import {
  defineStore,
  applyPlugin,
  resetStore,
  resetAllStores,
  getActiveStoreIds
} from '@actview/store'

function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'store-host'
  document.body.appendChild(host)
  createApp(component).mount('#store-host')
  return host
}

describe('@actview/store', () => {
  beforeEach(() => resetAllStores())

  it('defineStore 单例：同 id 多次 useStore 返回同一实例', () => {
    const useCounter = defineStore('counter', () => {
      const state = reactive({ count: 0 })
      function inc() {
        state.count++
      }
      return { state, inc }
    })
    const a = useCounter()
    const b = useCounter()
    expect(a).toBe(b)
  })

  it('响应式：store 状态修改共享可见', () => {
    const useCounter = defineStore('counter2', () => {
      const state = reactive({ count: 0 })
      function inc() {
        state.count++
      }
      const double = computed(() => state.count * 2)
      return { state, inc, double }
    })
    const c = useCounter()
    c.inc()
    expect(c.state.count).toBe(1)
    expect(c.double.value).toBe(2)
  })

  it('resetStore 重新执行 setup', () => {
    let created = 0
    const useS = defineStore('resettable', () => {
      created++
      return { v: created }
    })
    expect(useS().v).toBe(1)
    resetStore('resettable')
    expect(useS().v).toBe(2)
  })

  it('applyPlugin 在 store 创建时调用（持久化/订阅扩展点）', () => {
    const seen: string[] = []
    applyPlugin(({ id }) => seen.push(id))
    const useX = defineStore('plugged', () => ({ v: 1 }))
    useX()
    expect(seen).toContain('plugged')
  })

  it('getActiveStoreIds 列出已创建 store', () => {
    defineStore('a', () => ({}))()
    defineStore('b', () => ({}))()
    expect(getActiveStoreIds()).toEqual(['a', 'b'])
  })

  it('组件内 store 状态变化触发更新', async () => {
    const useCounter = defineStore('counter-comp', () => {
      const state = reactive({ count: 0 })
      function inc() {
        state.count++
      }
      return { state, inc }
    })
    function App() {
      const c = useCounter()
      return <div class="app">{c.state.count}</div>
    }
    const host = mount(App)
    expect(host.textContent).toBe('0')
    useCounter().inc()
    await nextTick()
    expect(host.textContent).toBe('1')
  })
})
