// ============================================================
// babel-host 排除规则测试（createBabelTransform / transformWithBabel）
// 覆盖：node_modules 硬排除（/ 与 \ 双兼容，include 不可覆盖）/
//       include 白名单 / exclude 黑名单 / transformWithBabel 同步生效
// 运行：npx vitest run plugins/babel/test/babel-host.test.ts
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createBabelTransform,
  createBabelItem,
  isExcludedTransform,
  transformWithBabel,
} from '../src/babel-host'
import defineComponentPlugin from '../src/babel-plugin'

const item = createBabelItem(defineComponentPlugin)

describe('babel-host：node_modules 硬排除', () => {
  it('node_modules 下的文件返回 null（不转换）', () => {
    const transform = createBabelTransform(defineComponentPlugin)
    expect(
      transform('function A() { return <div/> }', 'E:/proj/node_modules/pkg/A.tsx'),
    ).toBeNull()
    expect(
      transform('function A() { return <div/> }', 'E:/proj/node_modules/@scope/pkg/A.tsx'),
    ).toBeNull()
  })

  it('windows 反斜杠路径与根级 node_modules 也识别', () => {
    expect(isExcludedTransform('E:\\proj\\node_modules\\pkg\\A.tsx')).toBe(true)
    expect(isExcludedTransform('node_modules/pkg/A.tsx')).toBe(true)
  })

  it('include 白名单无法覆盖 node_modules 硬排除', () => {
    const transform = createBabelTransform(defineComponentPlugin, {
      include: [/node_modules\/my-lib/],
    })
    expect(
      transform('function A() { return <div/> }', 'E:/proj/node_modules/my-lib/A.tsx'),
    ).toBeNull()
  })

  it('项目内源码正常转换', () => {
    const transform = createBabelTransform(defineComponentPlugin)
    const r = transform('function A() { return <div>hi</div> }', 'E:/proj/src/A.tsx')
    expect(r?.code).toContain('defineComponent')
  })

  it('路径脱离 node_modules（alias 后形态）即恢复转换', () => {
    // 库需要现场编译时的标准解法：vite/rollup alias 到包源码，路径不再含
    // node_modules 段 → 进入源码管线正常转换
    const transform = createBabelTransform(defineComponentPlugin)
    const r = transform(
      'function A() { return <div>hi</div> }',
      'E:/proj/.vite-deps/my-lib/src/A.tsx',
    )
    expect(r?.code).toContain('defineComponent')
  })
})

describe('babel-host：include / exclude 规则', () => {
  it('exclude 黑名单：命中任一规则即跳过（优先级高于 include）', () => {
    const transform = createBabelTransform(defineComponentPlugin, {
      include: [/^E:\/proj\//],
      exclude: [/\.test\.tsx$/, 'vendor'],
    })
    expect(transform('x', 'E:/proj/src/A.test.tsx')).toBeNull()
    expect(transform('x', 'E:/proj/src/vendor/x.tsx')).toBeNull()
    expect(
      transform('function A() { return <div/> }', 'E:/proj/src/A.tsx'),
    ).not.toBeNull()
  })

  it('include 白名单：未命中不转换', () => {
    const transform = createBabelTransform(defineComponentPlugin, {
      include: [/^E:\/proj\/src\//],
    })
    expect(transform('x', 'E:/proj/other/A.tsx')).toBeNull()
    expect(
      transform('function A() { return <div/> }', 'E:/proj/src/A.tsx'),
    ).not.toBeNull()
  })

  it('transformWithBabel 同步应用排除规则', () => {
    expect(transformWithBabel('x', 'E:/proj/node_modules/pkg/A.tsx', item)).toBeNull()
    expect(
      transformWithBabel(
        'function A() { return <div/> }',
        'E:/proj/src/A.tsx',
        item,
      )?.code,
    ).toContain('defineComponent')
  })
})
