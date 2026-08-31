// ============================================================
// form 关联属性渲染验证（临时）：<button form> 等走通用 attribute
// 运行：pnpm exec vitest run test/debug-formattr.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp } from '@actview/core'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'fa-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('button form 关联属性', () => {
  it('form / formMethod / formNoValidate 渲染为真实属性（camelCase 被浏览器小写化）', () => {
    function App() {
      return (
        <button form="f1" formMethod="post" formNoValidate={true}>
          go
        </button>
      )
    }
    const host = mount(App)
    const btn = host.querySelector('button')!
    expect(btn.getAttribute('form')).toBe('f1')
    expect(btn.getAttribute('formmethod')).toBe('post')
    expect(btn.getAttribute('formnovalidate')).toBe('')
  })
})
