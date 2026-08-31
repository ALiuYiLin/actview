// ============================================================
// Suspense 异步组件（v2：vue 语义——async setup / defineAsyncComponent）
//   v1 的 lazy() API 不迁移（v2 用 defineAsyncComponent，见 AsyncPage demo）
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, nextTick, Suspense, defineComponent } from 'actview'

// ---------- helpers（来自 test/runtime-enhance.test.tsx）----------
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'enh-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ---------- helpers（来自 test/verify.test.tsx，因 mount 签名不同而重命名）----------
/** 创建带容器 id 的宿主元素并挂载组件（来自 verify.test.tsx） */
function mountId(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

// ============================================================
// test/runtime-enhance.test.tsx — Suspense 增强
// ============================================================
describe('Suspense 增强', () => {
  it('异步 setup（返回 Promise<render>）配合 Suspense', async () => {
    const Async = defineComponent(async function () {
      await Promise.resolve()
      return <div class="async">async content</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="loading">loading</div>}>
          <Async />
        </Suspense>
      )
    }
    const host = mount(App)
    // pending 期间显示 fallback（React 语义桥接：fallback prop → #fallback 插槽）
    expect(host.querySelector('.loading')).not.toBeNull()
    await flush()
    expect(collectText(host)).toContain('async content')
  })

  it('嵌套 Suspense 独立 fallback', async () => {
    const Inner = defineComponent(async function () {
      await Promise.resolve()
      return <div class="inner">inner</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="outer-loading">outer</div>}>
          <div class="outer-wrap">
            <Suspense fallback={<div class="inner-loading">inner-loading</div>}>
              <Inner />
            </Suspense>
          </div>
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(host.querySelector('.inner')).not.toBeNull()
  })
})

// ------------------------------------------------------------
// 场景 15：Suspense + 异步组件
//   v1 的 lazy() 是特有 API——用例移除；v2 用 defineAsyncComponent
//   （vue 官方，见 src/pages/AsyncPage.tsx 的 Suspense + defineAsyncComponent demo）
// ------------------------------------------------------------