// ============================================================
// React 属性名 → HTML 属性名 映射（P0-1/2）
//   htmlFor→for、tabIndex→tabindex、readOnly→readonly 等整批 camelCase
//   prop，运行时 setProp 与 SSR serializeAttrs 统一查 HTML_ATTR_OVERRIDES。
//   重点验证：映射后真实属性名存在、React prop 名（camelCase）不泄漏为字面属性。
// 运行：pnpm exec vitest run test/renderer/dom-attr-mapping.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, ref, nextTick, renderToString } from 'actview'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'attr-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

describe('React DOM 属性名映射（运行时）', () => {
  it('htmlFor → for（label 关联，且不泄漏 htmlFor 字面属性）', () => {
    function App() {
      return <label htmlFor="x">a</label>
    }
    const host = mount(App)
    const label = host.querySelector('label')!
    expect(label.getAttribute('for')).toBe('x')
    expect(label.hasAttribute('htmlFor')).toBe(false)
  })

  it('tabIndex → tabindex', () => {
    function App() {
      return <div tabIndex={2}>a</div>
    }
    const host = mount(App)
    expect(host.querySelector('div')!.getAttribute('tabindex')).toBe('2')
  })

  it('readOnly / maxLength / autoComplete / spellCheck 整批映射', () => {
    function App() {
      return (
        <input readOnly maxLength={10} autoComplete="off" spellCheck={false} />
      )
    }
    const host = mount(App)
    const el = host.querySelector('input')!
    expect(el.hasAttribute('readonly')).toBe(true)
    expect(el.getAttribute('maxlength')).toBe('10')
    expect(el.getAttribute('autocomplete')).toBe('off')
    // spellCheck={false}：enumerated 属性 → "false" 不移除（对齐 React）
    expect(el.getAttribute('spellcheck')).toBe('false')
  })

  it('encType / acceptCharset / colSpan / rowSpan / srcSet', () => {
    function App() {
      return (
        <form encType="multipart/form-data" acceptCharset="utf-8" method="post">
          <table>
            <td colSpan={2} rowSpan={3} />
          </table>
          <img srcSet="a.png 1x" />
        </form>
      )
    }
    const host = mount(App)
    const form = host.querySelector('form')!
    expect(form.getAttribute('enctype')).toBe('multipart/form-data')
    expect(form.getAttribute('accept-charset')).toBe('utf-8')
    const td = host.querySelector('td')!
    expect(td.getAttribute('colspan')).toBe('2')
    expect(td.getAttribute('rowspan')).toBe('3')
    expect(host.querySelector('img')!.getAttribute('srcset')).toBe('a.png 1x')
  })

  it('readOnly 响应式：false 移除、true 还原（映射后的属性名）', async () => {
    const ro = ref(true)
    function App() {
      return <input readOnly={ro.value} />
    }
    const host = mount(App)
    const el = host.querySelector('input')!
    expect(el.hasAttribute('readonly')).toBe(true)
    ro.value = false
    await nextTick()
    expect(el.hasAttribute('readonly')).toBe(false)
    ro.value = true
    await nextTick()
    expect(el.hasAttribute('readonly')).toBe(true)
  })
})

describe('React DOM 属性名映射（SSR）', () => {
  it('renderToString 输出真实属性名，不泄漏 camelCase prop', () => {
    const html = renderToString(
      <label htmlFor="x">
        <input tabIndex={1} readOnly maxLength={5} />
      </label>,
    )
    expect(html).toContain('for="x"')
    expect(html).not.toContain('htmlFor')
    expect(html).toContain('tabindex="1"')
    expect(html).toContain('readonly')
    expect(html).toContain('maxlength="5"')
    expect(html).not.toContain('tabIndex')
  })
})
