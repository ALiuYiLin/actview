// vite-plugin.test.ts — actviewScopedPlugin() 子插件单元测试
// 重点覆盖：node_modules 下的源码分发主题包（actpress 场景）——JSX 必须注入
// data-v-hash，不能因路径含 node_modules 被跳过（回归：v0.2.0 硬跳过 bug）。
import { describe, it, expect } from 'vitest'
import { actviewScopedPlugin } from '../src/vite-plugin.ts'
import { getHash } from '../src/css.ts'

const NM = 'E:/proj/node_modules/@actview/press/dist/theme'

describe('actviewScopedPlugin：node_modules 下源码分发主题包', () => {
  it('JSX 子插件：node_modules 路径含 ?scoped 也注入 data-v-hash', async () => {
    const [, jsx] = actviewScopedPlugin() as any[]
    const out = await jsx.transform(
      `
import './button.css?scoped'
export function VPButton() {
  return <button class="vp">OK</button>
}
`,
      `${NM}/Button.tsx`,
    )
    expect(out).not.toBeNull()
    const hash = getHash(`${NM}/button.css`)
    expect(out.code).toContain(`data-v-${hash}`)
  })

  it('JSX 子插件：node_modules 路径不含 ?scoped → null（性能路径仍生效）', async () => {
    const [, jsx] = actviewScopedPlugin() as any[]
    const out = await jsx.transform(
      `export function Plain() { return <div>no scoped</div> }`,
      `${NM}/Plain.tsx`,
    )
    expect(out).toBeNull()
  })

  it('JSX 子插件：非 tsx/jsx/js 扩展名仍跳过', async () => {
    const [, jsx] = actviewScopedPlugin() as any[]
    const out = await jsx.transform(
      `import './button.css?scoped'\nconst x = 1`,
      `${NM}/helper.ts`,
    )
    expect(out).toBeNull()
  })

  it('CSS 子插件：node_modules 下 ?scoped 正常变换（两侧一致）', async () => {
    const [css] = actviewScopedPlugin() as any[]
    const hash = getHash(`${NM}/button.css`)
    const out = await css.transform('.vp { color: red }', `${NM}/button.css?scoped`)
    expect(out.code).toContain(`.vp[data-v-${hash}]`)
  })

  it('JSX 与 CSS 子插件 hash 一致（同 absPath）', async () => {
    const [css, jsx] = actviewScopedPlugin() as any[]
    const cssOut = await css.transform('.a { color: red }', `${NM}/a.css?scoped`)
    const jsxOut = await jsx.transform(
      `import './a.css?scoped'\nexport const C = () => <div class="a">x</div>`,
      `${NM}/C.tsx`,
    )
    const cssHash = (cssOut.code.match(/data-v-([0-9a-f]{8})/)?.[1] ?? '') as string
    expect(jsxOut.code).toContain(`data-v-${cssHash}`)
  })
})
