// ============================================================
// 渲染函数早退 return 的嵌套组件更新行为
//   插件修复（babel-defineComponent）：无参渲染函数 =》 render 语义
//   （内部组件 __setup 返回渲染函数原样，早退 return null 留在 render 内，
//    响应式读取在 render effect =》 track ✓）。本文件验证：
//   1. 旧产物形态（内部 __setup 阶段做条件判断）是反模式——不保证更新
//   2. 正确形态（渲染函数内判断）正常更新
// 正确形态的完整回归见 scripts/verify.test.tsx 场景 30（VPSidebar 回归）
// ============================================================
import { describe, it, expect } from 'vitest'
import { createApp, ref, nextTick, defineComponent } from 'actview'

function mount(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

describe('setup 风格渲染函数与响应式更新', () => {
  it('反模式文档化：内部 __setup 阶段读响应式做条件判断 =》 固化（新插件不产出此形态）', async () => {
    // 这是旧插件产物形态（内部 __setup 直接条件 return null）——
    // setup 只执行一次，响应式读取在 setup 期收集不到内部渲染 effect，
    // render 被固化为 () => null。新插件（babel-defineComponent）不再产出；
    // 手写此形态是反模式（正确写法：条件判断放渲染函数内）。
    const hasSidebar = ref(false)
    const Side = defineComponent(function () {
      return defineComponent(function () {
        if (!hasSidebar.value) return null
        return () => <div class="side">SHOW</div>
      })
    })
    const host = mount('#sbug1', Side)
    expect(host.querySelector('.side')).toBeNull()

    hasSidebar.value = true
    await nextTick()
    // 固化：不更新（文档化反模式行为）
    expect(host.querySelector('.side')).toBeNull()
  })

  it('正确形态：__setup 返回渲染函数，条件判断在渲染函数内 =》 正常更新', async () => {
    const hasSidebar = ref(false)
    const Side = defineComponent(function () {
      return function () {
        if (!hasSidebar.value) return null
        return <div class="side">SHOW</div>
      }
    })
    const host = mount('#sbug2', Side)
    expect(host.querySelector('.side')).toBeNull()

    hasSidebar.value = true
    await nextTick()
    expect(host.querySelector('.side')?.textContent).toBe('SHOW')
  })
})
