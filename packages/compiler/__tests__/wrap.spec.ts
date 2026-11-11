import { describe, expect, it } from 'vitest'
import { transformSync } from '@babel/core'
import wrapComponentsPlugin, { type WrapComponentsOptions } from '../src/wrap'

/** 只用 L1 wrap 插件跑一遍 Babel（不引入 L2，因此 JSX 原样保留） */
function transform(code: string): string {
  return (
    transformSync(code, {
      plugins: [wrapComponentsPlugin],
      parserOpts: { plugins: ['jsx', 'typescript'] },
      configFile: false,
      babelrc: false,
    })?.code ?? ''
  )
}

/** 带插件选项的变体（importSource 等） */
function transformWithOptions(
  code: string,
  options: WrapComponentsOptions,
): string {
  return (
    transformSync(code, {
      plugins: [[wrapComponentsPlugin, options]],
      parserOpts: { plugins: ['jsx', 'typescript'] },
      configFile: false,
      babelrc: false,
    })?.code ?? ''
  )
}

const IMPORT_LINE = 'import { defineComponent } from "@actview/runtime-core";'

/** 捕获 transform 抛出的错误信息（断言代码帧用） */
function transformError(code: string): string {
  try {
    transform(code)
  } catch (error: any) {
    return String(error?.message ?? error)
  }
  throw new Error(`预期 ${JSON.stringify(code)} 抛出编译错误，实际成功`)
}

describe('L1 组件包装：基础形态', () => {
  it('函数声明 → const Name = defineComponent(function () {...}, "Name") 并注入 import', () => {
    const result = transform('function App() { return <div /> }')
    expect(result).toContain(IMPORT_LINE)
    // import 注入在 Program 顶部
    expect(result.startsWith(IMPORT_LINE)).toBe(true)
    expect(result).toContain('const App = defineComponent(function () {')
    expect(result).toContain('  return () => <div />;')
    expect(result).toContain('}, "App");')
  })

  it('变量声明 init 为箭头（expression body）→ block 返回 render 函数', () => {
    const result = transform('const App = () => <div />')
    expect(result).toContain(
      'const App = defineComponent(() => {\n  return () => <div />;\n}, "App");',
    )
  })

  it('变量声明 init 为箭头（block body）→ 包装直接 return', () => {
    const result = transform('const App = () => { return <div /> }')
    expect(result).toContain('const App = defineComponent(() => {')
    expect(result).toContain('return () => <div />;')
    expect(result).toContain('}, "App");')
  })

  it('变量声明 init 为函数表达式', () => {
    const result = transform('const App = function () { return <div /> }')
    expect(result).toContain('const App = defineComponent(function () {')
    expect(result).toContain('}, "App");')
  })

  it('保留变量声明 kind（let / var）', () => {
    expect(transform('let App = () => <div />')).toContain(
      'let App = defineComponent(',
    )
    expect(transform('var App = () => <div />')).toContain(
      'var App = defineComponent(',
    )
  })

  it('export 命名变量声明同样包装', () => {
    const result = transform('export const App = () => <div />')
    expect(result).toContain('export const App = defineComponent(')
    expect(result).toContain('}, "App");')
  })

  it('async 箭头 expression body → 保留 async 并改成 block', () => {
    const result = transform('const App = async () => <div />')
    expect(result).toContain('const App = defineComponent(async () => {')
    expect(result).toContain('return () => <div />;')
  })

  it('嵌套子组件各自包装（函数声明 + 变量声明两种形态）', () => {
    const result = transform(
      `function App() {
        const Child = () => <span />
        return <div><Child /></div>
      }`,
    )
    expect(result).toContain('const App = defineComponent(function () {')
    expect(result).toContain('const Child = defineComponent(() => {')
    expect(result).toContain('}, "Child");')
    expect(result).toContain('}, "App");')
    // defineComponent 只注入一次
    expect(result.match(/import \{ defineComponent \}/g)).toHaveLength(1)
  })

  it('嵌套函数声明子组件也被包装', () => {
    const result = transform(
      `function App() {
        function Child() { return <span /> }
        return <div><Child /></div>
      }`,
    )
    expect(result).toContain('const App = defineComponent(function () {')
    expect(result).toContain('const Child = defineComponent(function () {')
    expect(result).toContain('}, "Child");')
  })

  it('综合模块：接口 / 导出组件 / export default 标识符', () => {
    const result = transform(`
      import { ref } from '@actview/reactivity'
      interface Props { title: string }
      export function App(props: Props): JSX.Element {
        const count = ref(0)
        if (count.value > 1) return <b>big</b>
        return <div>{props.title}</div>
      }
      export const Header = () => <h1>header</h1>
      export default App
    `)
    expect(result).toContain(
      'export const App = defineComponent(function (props: Props) {',
    )
    expect(result).toContain('if (count.value > 1) return () => <b>big</b>;')
    expect(result).toContain('return () => <div>{props.title}</div>;')
    expect(result).toContain('export const Header = defineComponent(() => {')
    expect(result).toContain('export default App;')
    expect(result).not.toContain('JSX.Element')
  })

  it('export 命名函数声明也包装（保留导出）', () => {
    const result = transform('export function App() { return <div /> }')
    expect(result).toContain('export const App = defineComponent(function () {')
    expect(result).toContain('}, "App");')
  })
})

describe('L1 组件包装：默认导出', () => {
  it('匿名箭头默认导出 → 不传 name', () => {
    const result = transform('export default () => <div />')
    expect(result).toContain('export default defineComponent(() => {')
    expect(result).toContain('return () => <div />;')
    // 无第二个 name 参数
    expect(result).not.toMatch(/defineComponent\(\(\) => \{[\s\S]*?\}, "/)
  })

  it('匿名函数声明默认导出 → 不传 name', () => {
    const result = transform('export default function () { return <div /> }')
    expect(result).toContain('export default defineComponent(function () {')
    expect(result).not.toContain('}, "')
  })

  it('具名函数声明默认导出 → 用函数名作 name', () => {
    const result = transform('export default function App() { return <div /> }')
    expect(result).toContain('export default defineComponent(function () {')
    expect(result).toContain('}, "App");')
  })

  it('函数表达式默认导出（具名）保留函数名并传 name', () => {
    const result = transform(
      'export default (function App() { return <div /> })',
    )
    expect(result).toContain('export default defineComponent(function App() {')
    expect(result).toContain('}, "App");')
  })
})

describe('L1 组件包装：return 形态', () => {
  it('早退 return <JSX /> → return () => <JSX />', () => {
    const result = transform(
      'function App(props: any) { if (!props.ok) return <span />; return <div /> }',
    )
    expect(result).toContain('if (!props.ok) return () => <span />;')
    expect(result).toContain('return () => <div />;')
  })

  it('早退 return null → return () => null', () => {
    const result = transform(
      'function App(props: any) { if (!props.ok) return null; return <div /> }',
    )
    expect(result).toContain('if (!props.ok) return () => null;')
    expect(result).toContain('return () => <div />;')
  })

  it('裸 return → return () => null', () => {
    const result = transform(
      'function App(props: any) { if (!props.ok) return; return <div /> }',
    )
    expect(result).toContain('if (!props.ok) return () => null;')
  })

  it('末尾不是 ReturnStatement → 追加 return () => null', () => {
    const result = transform(
      'function App(props: any) { if (props.ok) { return <div /> } }',
    )
    expect(result).toContain('return () => <div />;')
    expect(result).toContain('return () => null;')
  })

  it('空函数体 → 追加 return () => null', () => {
    const result = transform('function App() {}')
    expect(result).toContain('return () => null;')
  })

  it('嵌套回调函数里的 return 不受影响（只处理组件函数自身）', () => {
    const result = transform(
      'function App() { return <div onClick={() => { return 1 }} /> }',
    )
    expect(result).toContain('return () => <div onClick={() => {')
    expect(result).toContain('return 1;')
  })
})

describe('L1 组件包装：TS 特性', () => {
  it('async 保留', () => {
    const result = transform('async function App() { return <div /> }')
    expect(result).toContain('defineComponent(async function () {')
    expect(result).toContain('return () => <div />;')
  })

  it('泛型 typeParameters 保留', () => {
    const result = transform('function App<T>(props: T) { return <div /> }')
    expect(result).toContain('defineComponent(function <T>(props: T) {')
    expect(result).toContain('return () => <div />;')
  })

  it('as 断言：解包后包装，断言重新套在 defineComponent 调用外', () => {
    const result = transform(
      'const App = ((props: any) => <div />) as (props: any) => any',
    )
    expect(result).toContain(
      'const App = defineComponent((props: any) => {',
    )
    expect(result).toContain('}, "App") as (props: any) => any;')
  })

  it('非空断言 ! 重新套在调用外', () => {
    const result = transform(
      'const App = (function () { return <div /> })!',
    )
    expect(result).toContain('const App = defineComponent(function () {')
    expect(result).toContain('}, "App")!;')
  })

  it('satisfies 断言重新套在调用外', () => {
    const result = transform(
      'const App = (() => <div />) satisfies (() => any)',
    )
    expect(result).toContain('}, "App") satisfies () => any;')
  })

  it('剥掉 returnType 注解（setup 返回值已不是 Element）', () => {
    const result = transform('function App(): JSX.Element { return <div /> }')
    expect(result).not.toContain('JSX.Element')
    expect(result).toContain('defineComponent(function () {')
  })

  it('变量 init 上 as 包裹的箭头同样处理', () => {
    const result = transform(
      'const App = (() => <div />) as unknown as Component',
    )
    expect(result).toContain('}, "App") as unknown as Component;')
  })
})

describe('L1 组件包装：import 注入', () => {
  it('多个组件只注入一次 defineComponent import', () => {
    const result = transform(
      'function A() { return <a /> } function B() { return <b /> }',
    )
    expect(result.match(/import \{ defineComponent \}/g)).toHaveLength(1)
    expect(result).toContain('}, "A");')
    expect(result).toContain('}, "B");')
  })

  it('无组件转换时不注入 import', () => {
    expect(transform('const foo = () => <div />')).not.toContain(
      'defineComponent',
    )
  })

  it('已有 defineComponent 导入时不重复注入', () => {
    const result = transform(
      'import { defineComponent } from "@actview/runtime-core"; const App = () => <div />',
    )
    expect(result.match(/import \{ defineComponent \}/g)).toHaveLength(1)
    expect(result).toContain('const App = defineComponent(')
  })

  it('importSource 可配置', () => {
    const result = transformWithOptions('function App() { return <div /> }', {
      importSource: '@actview/custom-runtime',
    })
    expect(result).toContain(
      'import { defineComponent } from "@actview/custom-runtime";',
    )
  })

  it('插件实例跨文件复用：Program.enter 重置状态（下一个文件不误注入 import）', () => {
    // 手工复用同一个插件对象（模拟 Babel 跨 transform 复用插件实例）
    const sharedPlugin = wrapComponentsPlugin()
    const run = (code: string) =>
      transformSync(code, {
        plugins: [() => sharedPlugin],
        parserOpts: { plugins: ['jsx', 'typescript'] },
        configFile: false,
        babelrc: false,
      })?.code ?? ''

    expect(run('function App() { return <div /> }')).toContain(
      'import { defineComponent }',
    )
    // 第二个文件没有任何组件：若状态未重置会误注入 import
    expect(run('const foo = 1')).not.toContain('defineComponent')
    // 第三个文件有转换：正常注入
    expect(run('const Bar = () => <b />')).toContain(
      'import { defineComponent }',
    )
  })
})

describe('L1 组件包装：非组件不动', () => {
  it('小写函数不包装', () => {
    const result = transform('function app() { return <div /> }')
    expect(result).toContain('function app() {')
    expect(result).not.toContain('defineComponent')
  })

  it('对象属性上的函数不包装', () => {
    const result = transform('const obj = { App: () => <div /> }')
    expect(result).toContain('App: () => <div />')
    expect(result).not.toContain('defineComponent')
  })

  it('对象方法不包装', () => {
    const result = transform('const obj = { App() { return <div /> } }')
    expect(result).toContain('App() {')
    expect(result).not.toContain('defineComponent')
  })

  it('类方法不包装', () => {
    const result = transform('class Foo { App() { return <div /> } }')
    expect(result).toContain('App() {')
    expect(result).not.toContain('defineComponent')
  })

  it('赋值表达式不包装', () => {
    const result = transform('let App; App = () => <div />')
    expect(result).toContain('App = () => <div />')
    expect(result).not.toContain('defineComponent')
  })

  it('三元包裹的函数值不包装', () => {
    const result = transform(
      'const App = cond ? () => <div /> : () => <span />',
    )
    expect(result).toContain('cond ? () => <div /> : () => <span />')
    expect(result).not.toContain('defineComponent')
  })

  it('不触碰 JSX、不注入 jsx import', () => {
    const result = transform('function App() { return <div><span /></div> }')
    expect(result).toContain('return () => <div><span /></div>;')
    expect(result).not.toContain('_jsx')
    expect(result).not.toContain('jsx-runtime')
  })
})

describe('L1 组件包装：报错', () => {
  it('return 箭头函数 → 已废弃 setup 风格（代码帧定位）', () => {
    const message = transformError('function App() { return () => <div /> }')
    expect(message).toContain('已废弃的 setup 风格')
    expect(message).toContain('App')
    // 代码帧：源码行 + 定位插入符
    expect(message).toMatch(/>\s*1 \|/)
    expect(message).toContain('^')
  })

  it('箭头 expression body 返回函数字面量 → 报错', () => {
    expect(transformError('const App = () => () => <div />')).toContain(
      '已废弃的 setup 风格',
    )
    expect(transformError('const App = () => function () { return 1 }')).toContain(
      '已废弃的 setup 风格',
    )
  })

  it('早退 return 函数字面量 → 报错', () => {
    expect(
      transformError(
        'function App() { if (x) return () => <div />; return <div /> }',
      ),
    ).toContain('已废弃的 setup 风格')
  })

  it('默认导出体内 return 函数字面量 → 报错', () => {
    expect(
      transformError('export default function App() { return () => <div /> }'),
    ).toContain('已废弃的 setup 风格')
  })

  it('generator 函数声明 / 函数表达式 → 报错', () => {
    expect(transformError('function* App() { return <div /> }')).toContain(
      'generator',
    )
    expect(
      transformError('const App = function* () { return <div /> }'),
    ).toContain('generator')
  })
})

describe('L1 组件包装：幂等', () => {
  it('已包装产物再次 transform 不变', () => {
    const once = transform('function App() { return <div /> }')
    expect(transform(once)).toBe(once)
  })

  it('默认导出产物再次 transform 不变', () => {
    const once = transform('export default function App() { return <div /> }')
    expect(transform(once)).toBe(once)
  })

  it('手写 defineComponent 不被重复包装', () => {
    const result = transform(
      'import { defineComponent } from "@actview/runtime-core"; const App = defineComponent(() => () => null)',
    )
    expect(result).toContain('const App = defineComponent(() => () => null);')
    expect(result.match(/import \{ defineComponent \}/g)).toHaveLength(1)
  })

  it('断言包裹的已有 defineComponent 调用不被重复包装', () => {
    const result = transform(
      'const App = (defineComponent(() => () => null) as any)',
    )
    expect(result).toContain('defineComponent(() => () => null) as any')
    expect(result.match(/defineComponent\(/g)).toHaveLength(1)
  })
})
