// vite-plugin.test.ts — actviewScopedPlugin() 子插件单元测试
// 排除规则（@actview/plugin-babel 2.1.0 起）：node_modules 硬排除——JSX 注入不碰
// node_modules；源码分发主题包（actpress 场景）需现场编译时，在 vite config
// 里 alias 到包源码（路径脱离 node_modules 段）即可恢复（历史：v0.2.0 曾硬跳过
// 导致主题包 CSS scoped 化但元素无属性——现由路径转换方案承接）。
import { describe, it, expect } from 'vitest'
import { actviewScopedPlugin } from '../src/vite-plugin.ts'
import { getHash } from '../src/css.ts'

const NM = 'E:/proj/node_modules/@actview/press/dist/theme'
const SRC = 'E:/proj/src/theme'

describe('actviewScopedPlugin：node_modules 硬排除', () => {
  it('JSX 子插件：node_modules 路径含 ?scoped 跳过（transform 返回 null）', async () => {
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
    expect(out).toBeNull()
  })

  it('JSX 子插件：include 规则无法覆盖 node_modules 硬排除', async () => {
    const [, jsx] = actviewScopedPlugin({
      babel: { include: [/node_modules\/@actview\/press/] },
    }) as any[]
    const out = await jsx.transform(
      `import './button.css?scoped'\nexport function B() { return <button/> }`,
      `${NM}/B.tsx`,
    )
    expect(out).toBeNull()
  })

  it('JSX 子插件：路径脱离 node_modules（alias 后形态）恢复注入', async () => {
    const [, jsx] = actviewScopedPlugin() as any[]
    const out = await jsx.transform(
      `import './button.css?scoped'\nexport function Btn() { return <button class="vp">OK</button> }`,
      `${SRC}/Btn.tsx`,
    )
    expect(out).not.toBeNull()
    const hash = getHash(`${SRC}/button.css`)
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

  it('CSS 子插件：node_modules 下 ?scoped 正常变换（CSS 侧不受排除影响）', async () => {
    const [css] = actviewScopedPlugin() as any[]
    const hash = getHash(`${NM}/button.css`)
    const out = await css.transform('.vp { color: red }', `${NM}/button.css?scoped`)
    expect(out.code).toContain(`.vp[data-v-${hash}]`)
  })
})

describe('actviewScopedPlugin：alias 后形态（源码路径）', () => {
  it('JSX 与 CSS 子插件 hash 一致（同 absPath）', async () => {
    const [css, jsx] = actviewScopedPlugin() as any[]
    const cssOut = await css.transform('.a { color: red }', `${SRC}/a.css?scoped`)
    const jsxOut = await jsx.transform(
      `import './a.css?scoped'\nexport const C = () => <div class="a">x</div>`,
      `${SRC}/C.tsx`,
    )
    const cssHash = (cssOut.code.match(/data-v-([0-9a-f]{8})/)?.[1] ?? '') as string
    expect(jsxOut.code).toContain(`data-v-${cssHash}`)
  })
})
