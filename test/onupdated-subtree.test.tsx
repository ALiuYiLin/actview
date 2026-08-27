// ============================================================
// onUpdated 时序语义验收（RadioRoot labelable 悖论的框架侧确认）
//   Outer 的子树含子组件 Inner（包裹 input）——patch(Inner) 是 queueJob
//   （微任务），Outer 的 onUpdated 在 Inner patch 之前触发 → 读到旧 DOM；
//   nextTick 延迟解析可读到新 DOM（对齐 Vue 3：onUpdated 只保证自身
//   子树 patch 完，不保证子组件已更新）
// 运行：pnpm exec vitest run test/onupdated-subtree.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, nextTick, onUpdated, ref } from 'actview'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'ou-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('onUpdated 时序悖论', () => {
  it('Outer 的 onUpdated 读到旧 DOM（Inner 是子组件，patch 被 queueJob 延迟）', async () => {
    const id = ref('a')
    const reads: string[] = []
    function Inner(props: any) {
      return <input id={props.id} />
    }
    function Outer() {
      onUpdated(() => {
        reads.push((document.querySelector('input') as HTMLInputElement).id)
      })
      return <Inner id={id.value} />
    }
    const host = mount(Outer)
    id.value = 'b'
    await nextTick() // 完整 flush 后
    console.log('[debug] reads at onUpdated =', JSON.stringify(reads))
    console.log('[debug] final DOM id =', (document.querySelector('input') as HTMLInputElement).id)
    expect(reads[0]).toBe('a') // onUpdated 时读到旧值（悖论）
    expect((document.querySelector('input') as HTMLInputElement).id).toBe('b')
  })

  it('修复：onUpdated 里 nextTick 延迟解析 → 读到新 DOM', async () => {
    const id = ref('a')
    const reads: string[] = []
    function Inner(props: any) {
      return <input id={props.id} />
    }
    function Outer() {
      onUpdated(() => {
        void nextTick(() => {
          reads.push((document.querySelector('input') as HTMLInputElement).id)
        })
      })
      return <Inner id={id.value} />
    }
    const host = mount(Outer)
    id.value = 'b'
    await nextTick()
    await nextTick()
    console.log('[debug] reads with nextTick =', JSON.stringify(reads))
    expect(reads[0]).toBe('b') // 延迟解析读到新值
  })
})
