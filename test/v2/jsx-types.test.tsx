// ============================================================
// v2 JSX 类型层验收（编译期断言 + 运行时冒烟）
// 验证：pnpm exec tsc -p tsconfig.v2.json --noEmit
// 运行：pnpm exec vitest run test/v2
// ============================================================
import { describe, expect, it } from 'vitest'
import { createContext, defineComponent, reactive, ref } from 'actview'

describe('v2: JSX 类型层', () => {
  it('React 语义属性可用（className/htmlFor/onChange/onClick）', () => {
    const App = defineComponent(function () {
      const count = ref(0)
      const text = ref('')
      return (
        <div className="app">
          <label htmlFor="inp">L</label>
          <input
            id="inp"
            className="field"
            value={text.value}
            onChange={(e: any) => {
              text.value = e.target.value
            }}
          />
          <button className="btn" onClick={() => count.value++}>
            +
          </button>
          <div dangerouslySetInnerHTML={{ __html: '<b>x</b>' }} />
        </div>
      )
    })
    expect(App).toBeTruthy()
  })

  it('v-model / v-show 指令属性可用', () => {
    const App = defineComponent(function () {
      const n = ref(0)
      return (
        <div>
          <input v-model={n.value} />
          <span v-show={n.value > 0}>{n.value}</span>
        </div>
      )
    })
    expect(App).toBeTruthy()
  })

  it('vue 组件（defineComponent 产物）可作为 JSX 组件，props 类型检查', () => {
    const Card = defineComponent(function (props: {
      title?: string
      children?: any
    }) {
      return () => (
        <section className="card" data-title={props.title ?? ''}>
          {props.children}
        </section>
      )
    })
    const App = defineComponent(function () {
      return (
        <Card title="t">
          <span>child</span>
        </Card>
      )
    })
    expect(App).toBeTruthy()
  })

  it('createContext 的 Provider 可直接作组件', () => {
    const Ctx = createContext(reactive({ color: 'red' }))
    const App = defineComponent(function () {
      return (
        <Ctx.Provider value={reactive({ color: 'blue' })}>
          <span>c</span>
        </Ctx.Provider>
      )
    })
    expect(App).toBeTruthy()
  })

  it('intrinsic 属性：vue 全局索引 any 放行（vue 生态宽松语义）', () => {
    // vue 的 jsx.d.ts 声明 [elem: string]: any——原生元素任意属性可用
    // （v2 严格性落在组件 props 层，见下一用例）
    const Ok = <div className={123 as any} data-anything="x" />
    expect(Ok).toBeDefined()
  })

  it('未知标签报错（React 严格语义：IntrinsicElements 无索引兜底）', () => {
    // @ts-expect-error 未知小写标签（v2 全局 IntrinsicElements 是完整表，无 [tag: string] 索引）
    const Bad = <unknown-tag foo="x" />
    expect(Bad).toBeDefined()
  })

  it('负向：组件未知 prop 报错（React 严格语义）', () => {
    const Card = defineComponent(function (props: { title?: string }) {
      return () => <div>{props.title}</div>
    })
    // @ts-expect-error 组件未声明 foo prop
    const Bad = <Card foo="x" />
    expect(Bad).toBeDefined()
  })
})
