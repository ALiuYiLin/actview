// ============================================================
// css.test.ts — transformScopedCSS / getHash 单元测试
// ============================================================

import { describe, it, expect } from 'vitest'
import { transformScopedCSS, getHash, scopeAttr } from '../src/css.ts'

const HASH = 'abc12345'
const ATTR = `data-v-${HASH}`
const transform = (css: string) => transformScopedCSS(css, HASH)

describe('transformScopedCSS 基础注入', () => {
  it('普通规则：最后一个简单选择器后插入 [data-v-hash]', async () => {
    expect(await transform('.foo { color: red }')).toBe(
      `.foo[${ATTR}] { color: red }`,
    )
  })

  it('后代选择器：仅最后一个简单选择器注入', async () => {
    expect(await transform('.a .b { margin: 0 }')).toBe(
      `.a .b[${ATTR}] { margin: 0 }`,
    )
  })

  it('逗号分组：每个选择器独立注入', async () => {
    expect(await transform('.a, .b { padding: 1px }')).toBe(
      `.a[${ATTR}], .b[${ATTR}] { padding: 1px }`,
    )
  })

  it('属性/伪类选择器：伪类不作为锚点，注入点在其之前（Vue 语义）', async () => {
    expect(await transform('input[type="text"]:focus { outline: none }')).toBe(
      `input[type="text"][${ATTR}]:focus { outline: none }`,
    )
  })

  it('通配符：* 单独时转为 [data-v-hash]，前有锚点时注入锚点', async () => {
    expect(await transform('* { box-sizing: border-box }')).toBe(
      `[${ATTR}] { box-sizing: border-box }`,
    )
    expect(await transform('.f * { color: red }')).toBe(
      `.f[${ATTR}] * { color: red }`,
    )
  })
})

describe('transformScopedCSS @规则', () => {
  it('@media 内规则递归注入', async () => {
    expect(
      await transform('@media (max-width: 100px) { .m { width: 50px } }'),
    ).toBe(`@media (max-width: 100px) { .m[${ATTR}] { width: 50px } }`)
  })

  it('@supports 内规则递归注入', async () => {
    expect(
      await transform('@supports (display: grid) { .g { display: grid } }'),
    ).toBe(`@supports (display: grid) { .g[${ATTR}] { display: grid } }`)
  })

  it('@font-face / @import / @charset 原样跳过', async () => {
    expect(
      await transform('@font-face { font-family: x } @import "a.css";'),
    ).toBe('@font-face { font-family: x } @import "a.css";')
  })
})

describe('transformScopedCSS keyframes', () => {
  it('keyframes 重命名并同步改写 animation 引用', async () => {
    const out = await transform(
      '@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } } .box { animation: spin 2s }',
    )
    expect(out).toContain(`@keyframes spin-${HASH}`)
    expect(out).toContain(`animation: spin-${HASH} 2s`)
  })

  it('keyframes 内部 from/to 选择器不注入', async () => {
    const out = await transform('@keyframes fade { from { opacity: 0 } }')
    expect(out).toBe('@keyframes fade-abc12345 { from { opacity: 0 } }')
  })

  it('animation-name 独立声明同步改写', async () => {
    const out = await transform(
      '@keyframes k { to { top: 0 } } .x { animation-name: k }',
    )
    expect(out).toContain(`animation-name: k-${HASH}`)
  })
})

describe('transformScopedCSS 伪类语义', () => {
  it(':deep() 注入点前移，内部选择器不注入', async () => {
    expect(await transform('.a :deep(.b) { color: red }')).toBe(
      `.a[${ATTR}] .b { color: red }`,
    )
  })

  it(':slotted() 注入 -s 后缀属性', async () => {
    expect(await transform('.c :slotted(.d) { color: blue }')).toBe(
      `.c .d[${ATTR}-s] { color: blue }`,
    )
  })

  it(':global() 剥除包裹且不注入', async () => {
    expect(await transform(':global(.e) { color: green }')).toBe(
      `.e { color: green }`,
    )
  })

  it(':is()/:where() 内 deep 分裂处理', async () => {
    const out = await transform(
      ':is(.deep-a :deep(.b), .c) :deep(.d) { color: red }',
    )
    // 每个分支独立注入锚点
    expect(out).toContain(`.deep-a[${ATTR}] .b`)
    expect(out).not.toContain('.b[data-v')
  })
})

describe('getHash / scopeAttr', () => {
  it('同一路径 hash 稳定，不同路径不同，长度为 8', () => {
    const a = getHash('/proj/src/a.css')
    expect(getHash('/proj/src/a.css')).toBe(a)
    expect(getHash('/proj/src/b.css')).not.toBe(a)
    expect(a).toHaveLength(8)
  })

  it('scopeAttr 支持自定义前缀', () => {
    expect(scopeAttr(HASH)).toBe(`data-v-${HASH}`)
    expect(scopeAttr(HASH, 'data-test')).toBe(`data-test-${HASH}`)
  })
})
