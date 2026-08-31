// ============================================================
// v2 非法组件写法：setup 返回 render（return () => <JSX/>）→ 编译期抛错
//   React 里返回函数是非法 child；v2 统一 React 语义——
//   组件直接 return <JSX/>（函数体 = setup，JSX 自动包成 render）。
//   检测到 return () => <JSX/> / () => () => <JSX/> → buildCodeFrameError
// ============================================================
import { describe, expect, it } from 'vitest'
import { transformSync } from '@babel/core'
import jsxPlugin from '@actview/plugin-jsx'

function compile(code: string) {
  return transformSync(code, {
    filename: 'illegal.tsx',
    plugins: [[jsxPlugin, {}]],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    babelrc: false,
    configFile: false,
  })
}

const ILLEGAL_RE = /非法组件写法/

describe('v2: setup 返回 render 是非法写法（编译期抛错）', () => {
  it('auto-define：function App() { return () => <JSX/> } 抛错', () => {
    expect(() =>
      compile(`function App() { return () => <div>hi</div> }`),
    ).toThrow(ILLEGAL_RE)
  })

  it('显式 defineComponent：setup 返回 render 抛错', () => {
    expect(() =>
      compile(`import { defineComponent } from 'actview'
      const App = defineComponent(function () { return () => <div/> })`),
    ).toThrow(ILLEGAL_RE)
  })

  it('箭头组件返回箭头（() => () => <JSX/>）抛错', () => {
    expect(() => compile(`const App = () => () => <div/>`)).toThrow(
      ILLEGAL_RE,
    )
  })

  it('React 合法形态不抛错：直接 return JSX / 箭头 expression body', () => {
    expect(() =>
      compile(`function App() { return <div>hi</div> }`),
    ).not.toThrow()
    expect(() => compile(`const App = () => <div/>`)).not.toThrow()
  })
})
