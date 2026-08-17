// ============================================================
// useProp / useProps — props 响应式取值 + 默认值/转换（验收测试）
//   解决 setup 快照问题：返回 ComputedRef 活引用，父组件改 prop 自动更新
//   - useProp(props, key, normalize?)：单键（normalize 缺省 = 原始值）
//   - useProps(props, { key: normalize })：批量 + rest（未声明键集合）
//   覆盖：默认值 ?? 语义（falsy 保留）/ rest 透传 / 别名键 /
//         normalize 内派生依赖 / 组件集成（父改 prop → DOM 更新）
// 运行：pnpm vitest run scripts/useProps.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  createApp,
  reactive,
  shallowReactive,
  useProp,
  useProps
} from 'actview'

const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'useprops-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('useProp（单键）', () => {
  it('normalize 兜底默认值，falsy 明确传入不兜底（?? 语义）', () => {
    const props = shallowReactive<any>({})
    const variant = useProp(props, 'variant', (v: any) => v ?? 'default')
    const size = useProp(props, 'size', (v: any) => v ?? 'md')
    const count = useProp(props, 'count', (v: any) => v ?? 0)

    expect(variant.value).toBe('default')
    expect(size.value).toBe('md')
    expect(count.value).toBe(0)

    props.variant = 'primary'
    expect(variant.value).toBe('primary')

    // falsy 但显式传入：不被默认值替换
    props.size = ''
    expect(size.value).toBe('')
    props.count = 0
    expect(count.value).toBe(0)
    props.variant = false as any
    expect(variant.value).toBe(false)
  })

  it('无 normalize 时返回原始值（等价 toRef，不兜底）', () => {
    const props = shallowReactive<any>({ variant: 'primary' })
    const variant = useProp(props, 'variant')
    expect(variant.value).toBe('primary')

    const missing = useProp(props, 'missing')
    expect(missing.value).toBeUndefined()

    props.variant = 'secondary'
    expect(variant.value).toBe('secondary')
  })
})

describe('useProps（批量 + rest）', () => {
  it('命名 refs + rest：rest 只含未声明键，且随 props 变化同步', () => {
    const props = shallowReactive<any>({
      variant: 'primary',
      size: 'lg',
      disabled: true,
      id: 'btn-1'
    })
    const { variant, size, rest } = useProps(props, {
      variant: (v: any) => v ?? 'default',
      size: (v: any) => v ?? 'md'
    })
    expect(variant.value).toBe('primary')
    expect(size.value).toBe('lg')
    expect(rest.value).toEqual({ disabled: true, id: 'btn-1' })

    // 响应性：改 props → 命名 ref 与 rest 同步更新
    props.variant = 'secondary'
    expect(variant.value).toBe('secondary')
    props.disabled = false
    expect(rest.value.disabled).toBe(false)

    // 父组件新增 prop 键 → 自动出现在 rest（toRefs 的 ...rest 快照做不到）
    props.extra = 'x'
    expect(rest.value.extra).toBe('x')
    expect(variant.value).toBe('secondary')
  })

  it('别名键：map 用真实键 class，解构重命名取 className，且不落入 rest', () => {
    const props = shallowReactive<any>({ class: 'btn big' })
    const { class: className, rest } = useProps(props, {
      class: (v: any) => v ?? ''
    })
    expect(className.value).toBe('btn big')
    expect(rest.value).toEqual({})

    props.class = 'btn small'
    expect(className.value).toBe('btn small')
  })

  it('裸透传：map 值为 undefined 直接返回 props 原值（无需 (val) => val）', () => {
    const props = shallowReactive<any>({
      class: 'btn',
      className: 'legacy',
      variant: undefined
    })
    const { class: className, className: legacyClassName, variant, rest } = useProps(props, {
      class: undefined, // 裸透传：props.class 原值
      className: undefined,
      variant: (v: any) => v ?? 'default'
    })
    expect(className.value).toBe('btn')
    expect(legacyClassName.value).toBe('legacy')
    expect(variant.value).toBe('default') // 裸透传键不参与 normalize 兜底
    expect(rest.value).toEqual({}) // 三个键均已消费

    // 响应性：裸透传键同样跟随 props 更新
    props.class = 'btn big'
    expect(className.value).toBe('btn big')
    props.variant = 'primary'
    expect(variant.value).toBe('primary')
  })

  it('normalize 内读其他 props：建立派生依赖（默认值联动）', () => {
    const props = shallowReactive<any>({ variant: 'primary' })
    const { size } = useProps(props, {
      size: (v: any) => v ?? (props.variant === 'primary' ? 'lg' : 'md')
    })
    expect(size.value).toBe('lg')

    props.variant = 'secondary'
    expect(size.value).toBe('md') // 默认值随 variant 联动

    props.size = 'sm'
    expect(size.value).toBe('sm') // 显式传入优先
  })
})

describe('useProps 组件集成', () => {
  it('解构驱动 DOM：父组件改 prop → class 与 rest 透传属性同步更新', async () => {
    const state = reactive({ variant: 'default', label: 'Click' })
    function Button(props: any) {
      const { variant, size, rest } = useProps(props, {
        variant: (v: any) => v ?? 'default',
        size: (v: any) => v ?? 'md'
      })
      return (
        <button {...rest.value} class={`btn btn-${variant.value} btn-${size.value}`}>
          {props.children}
        </button>
      )
    }
    function App() {
      return (
        <Button variant={state.variant} data-state={state.variant}>
          {state.label}
        </Button>
      )
    }
    const host = mount(App)
    const btn = () => host.querySelector('button')!
    expect(btn().className).toBe('btn btn-default btn-md')
    expect(btn().getAttribute('data-state')).toBe('default')
    expect(btn().textContent).toBe('Click')

    state.variant = 'primary'
    await flush()
    expect(btn().className).toBe('btn btn-primary btn-md')
    expect(btn().getAttribute('data-state')).toBe('primary')

    // setup 快照模式：同场景直接解构会卡在旧值（对照）
    state.variant = 'secondary'
    await flush()
    expect(btn().className).toBe('btn btn-secondary btn-md')
    expect(btn().getAttribute('data-state')).toBe('secondary')
  })

  it('单参形式：组件内 useProps(map) / useProp(key) 自动取当前实例 props', async () => {
    const state = reactive({ variant: 'default', label: 'Click' })
    function Button() {
      // 无 props 参数：getCurrentInstance().props
      const { variant, size, rest } = useProps({
        variant: (v: any) => v ?? 'default',
        size: (v: any) => v ?? 'md'
      })
      const label = useProp('label', (v: any) => v ?? '')
      return (
        <button {...rest.value} class={`btn btn-${variant.value} btn-${size.value}`}>
          {label.value}
        </button>
      )
    }
    function App() {
      return (
        <Button variant={state.variant} data-state={state.variant} label={state.label}>
          ignore
        </Button>
      )
    }
    const host = mount(App)
    const btn = () => host.querySelector('button')!
    expect(btn().className).toBe('btn btn-default btn-md')
    expect(btn().getAttribute('data-state')).toBe('default')
    expect(btn().textContent).toBe('Click') // useProp 单参读取 props.label

    state.variant = 'primary'
    state.label = 'OK'
    await flush()
    expect(btn().className).toBe('btn btn-primary btn-md')
    expect(btn().getAttribute('data-state')).toBe('primary')
    expect(btn().textContent).toBe('OK')
  })

  it('单参形式在 setup 外调用报错', () => {
    expect(() => useProps({ variant: (v: any) => v })).toThrow(/只能在组件 setup 中调用/)
    expect(() => useProp('variant')).toThrow(/只能在组件 setup 中调用/)
  })
})
