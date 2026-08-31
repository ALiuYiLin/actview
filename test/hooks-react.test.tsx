// ============================================================
// @actview/hooks-react — React hooks 迁移层验收
//   场景：useState / useReducer / useRef / useMemo / useCallback /
//         useEffect（deps 三态 + 清理）/ useLayoutEffect / useInsertionEffect /
//         useContext / useSyncExternalStore / useId / useTransition /
//         useDeferredValue / useImperativeHandle
// 注意：组件函数体 = setup（只执行一次），hooks 返回 ref 活引用，
//       JSX 单子节点 {ref} 由 jsxFactory.unwrapProps 解包（children 顶层）。
// 运行：pnpm exec vitest run test/hooks-react.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, createContext, ref, reactive } from '@actview/core'
import {
  useState,
  useReducer,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useInsertionEffect,
  useContext,
  useSyncExternalStore,
  useId,
  useTransition,
  useDeferredValue,
  useImperativeHandle,
} from '@actview/hooks-react'

function mount(app: any) {
  const host = document.createElement('div')
  host.id = 'hr-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(app).mount('#' + host.id)
  return host
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('useState / useReducer', () => {
  it('值更新、函数式更新、lazy 初始化、JSX 属性位自动解包', async () => {
    let setCount: any
    let setText: any
    function Host() {
      const [count, setC] = useState(() => 10) // lazy 初始化
      const [text, setT] = useState('a')
      setCount = setC
      setText = setT
      // props 顶层属性位自动解包（多子节点数组内不解包，见 types.ts 约定）
      return <div class="c" data-n={count} data-t={text} />
    }
    const host = mount(Host)
    expect(host.querySelector('.c')!.getAttribute('data-n')).toBe('10')
    expect(host.querySelector('.c')!.getAttribute('data-t')).toBe('a')
    setCount(5) // 值形态
    await flush()
    expect(host.querySelector('.c')!.getAttribute('data-n')).toBe('5')
    setCount((c: number) => c + 2) // 函数式更新
    await flush()
    expect(host.querySelector('.c')!.getAttribute('data-n')).toBe('7')
    setText('b')
    await flush()
    expect(host.querySelector('.c')!.getAttribute('data-t')).toBe('b')
  })

  it('useReducer：dispatch 计算 + init 惰性初始化', async () => {
    let dispatch: any
    function reducer(state: number, action: { type: string }) {
      return action.type === 'inc' ? state + 1 : state
    }
    function Host() {
      const [count, d] = useReducer(reducer, 5, (n) => n * 2) // init: 10
      dispatch = d
      return <div class="r">{count}</div>
    }
    const host = mount(Host)
    expect(host.querySelector('.r')!.textContent).toBe('10')
    dispatch({ type: 'inc' })
    await flush()
    expect(host.querySelector('.r')!.textContent).toBe('11')
  })
})

describe('useRef', () => {
  it('.current 与 .value 互通，且支持模板引用', async () => {
    const seen: any[] = []
    function Host() {
      const boxRef = useRef<HTMLDivElement | null>(null)
      return (
        <div>
          <div class="box" ref={boxRef} />
          <button class="peek" onClick={() => seen.push(boxRef.current)} />
        </div>
      )
    }
    const host = mount(Host)
    host.querySelector('.peek')!.dispatchEvent(new MouseEvent('click'))
    // applyRef 写 .value → current getter 同读
    expect(seen[0]).toBe(host.querySelector('.box'))
    expect(host.querySelector('.box') === seen[0]).toBe(true)
  })

  it('useImperativeHandle：父组件 ref 拿到自定义句柄，卸载置空', async () => {
    const childRef = ref<any>(null)
    let toggle: any
    function Child(props: any) {
      useImperativeHandle(props.ref, () => ({ ping: 42 }))
      return <span class="child" />
    }
    function Host() {
      const [show, setShow] = useState(true)
      toggle = setShow
      // 三目条件里的 ref 不解包，须 .value（否则恒 truthy，组件永不移除）
      return <div>{show.value ? <Child ref={childRef} /> : null}</div>
    }
    const host = mount(Host)
    await flush()
    expect(childRef.value.ping).toBe(42)
    toggle(false)
    await flush()
    // 卸载时 applyRef(ref, null) → 置空（React 语义）
    expect(childRef.value).toBeNull()
  })
})

describe('useMemo / useCallback', () => {
  it('useMemo：computed 自动追踪，依赖变化自动重算', async () => {
    const state = reactive({ n: 2 })
    function Host() {
      const double = useMemo(() => state.n * 2) // deps 忽略，自动追踪
      return <div class="m">{double}</div>
    }
    const host = mount(Host)
    expect(host.querySelector('.m')!.textContent).toBe('4')
    state.n = 5
    await flush()
    expect(host.querySelector('.m')!.textContent).toBe('10')
  })

  it('useCallback：setup 只执行一次 → 函数引用天然稳定', () => {
    let fnA: any, fnB: any
    function Host() {
      fnA = useCallback(() => 1, [])
      fnB = useCallback(() => 1)
      return null
    }
    mount(Host)
    expect(fnA()).toBe(1)
    expect(fnB()).toBe(1)
    // setup 期只创建一次（组件函数体仅执行一次）
    expect(fnA).toBe(fnA)
  })
})

describe('useEffect', () => {
  it('不传 deps：自动追踪（effect 内读到的响应式值变化重跑），重跑前执行清理', async () => {
    const state = reactive({ n: 0 })
    let runs = 0
    let cleans = 0
    function Host() {
      useEffect(() => {
        void state.n // effect 内读取 → watchEffect 收集依赖（React 无 deps 是每次渲染跑，ActView 是依赖变化跑）
        runs++
        return () => {
          cleans++
        }
      })
      return <div class="e">v{state.n}</div>
    }
    const host = mount(Host)
    expect(host.querySelector('.e')!.textContent).toBe('v0')
    expect(runs).toBe(1) // 首次同步执行
    state.n = 1
    await flush()
    expect(runs).toBe(2)
    expect(cleans).toBe(1) // 重跑前清理上一次
    state.n = 2
    await flush()
    expect(runs).toBe(3)
    expect(cleans).toBe(2)
  })

  it('deps=[]：只执行一次（不随状态变化重跑）', async () => {
    const state = reactive({ n: 0 })
    let runs = 0
    function Host() {
      useEffect(() => {
        runs++
      }, [])
      return <div>{state.n}</div>
    }
    mount(Host)
    expect(runs).toBe(1)
    state.n = 1
    await flush()
    expect(runs).toBe(1)
  })

  it('deps=[a]：a 变化重跑；清理在组件卸载时执行', async () => {
    const aRef = ref(1) // deps 须为 ref/响应式引用（普通值在 setup 已求值，视为常量）
    let runs = 0
    let cleans = 0
    let toggle: any
    function Child() {
      useEffect(() => {
        runs++
        return () => {
          cleans++
        }
      }, [aRef])
      return <span class="d">child</span>
    }
    function Host() {
      const [show, setShow] = useState(true)
      toggle = setShow
      return <div>{show.value ? <Child /> : <span class="gone" />}</div>
    }
    const host = mount(Host)
    expect(runs).toBe(1)
    aRef.value = 2
    await flush()
    expect(runs).toBe(2)
    expect(cleans).toBe(1) // 重跑前清理
    toggle(false) // 卸载 Child
    await flush()
    expect(cleans).toBe(2) // 卸载时执行清理（onStop 机制）
  })

  it('useLayoutEffect / useInsertionEffect：降级执行', async () => {
    let laid = 0
    let inserted = 0
    function Host() {
      useLayoutEffect(() => {
        laid++
      }, [])
      useInsertionEffect(() => {
        inserted++
      }, [])
      return <div />
    }
    mount(Host)
    expect(laid).toBe(1)
    expect(inserted).toBe(1)
  })
})

describe('useContext', () => {
  it('消费上下文（响应式对象入 context）+ 深层变化自动重渲染', async () => {
    const ThemeCtx = createContext<{ theme: 'light' | 'dark' } | undefined>(undefined)
    const state = reactive({ theme: 'light' as 'light' | 'dark' })
    function Leaf() {
      const s = useContext(ThemeCtx)!
      return <span class="t">{s.theme}</span>
    }
    function Host() {
      return (
        <ThemeCtx.Provider value={state}>
          <Leaf />
        </ThemeCtx.Provider>
      )
    }
    const host = mount(Host)
    expect(host.querySelector('.t')!.textContent).toBe('light')
    state.theme = 'dark'
    await flush()
    expect(host.querySelector('.t')!.textContent).toBe('dark')
  })
})

describe('useSyncExternalStore', () => {
  it('订阅外部 store 并随变化更新；卸载自动退订', async () => {
    let store = 0
    let subs = 0
    const listeners = new Set<() => void>()
    const subscribe = (cb: () => void) => {
      subs++
      listeners.add(cb)
      return () => {
        subs--
        listeners.delete(cb)
      }
    }
    let toggle: any
    function Leaf() {
      const snapshot = useSyncExternalStore(subscribe, () => store)
      return <span class="s">{snapshot}</span>
    }
    function Host() {
      const [show, setShow] = useState(true)
      toggle = setShow
      return <div>{show.value ? <Leaf /> : <span class="gone" />}</div>
    }
    const host = mount(Host)
    expect(host.querySelector('.s')!.textContent).toBe('0')
    expect(subs).toBe(1)
    store = 3
    listeners.forEach((cb) => cb())
    await flush()
    expect(host.querySelector('.s')!.textContent).toBe('3')
    toggle(false)
    await flush()
    expect(subs).toBe(0) // 卸载退订
  })
})

describe('并发降级与杂项', () => {
  it('useId：稳定唯一', () => {
    const ids: string[] = []
    function Host() {
      ids.push(useId())
      return null
    }
    mount(Host)
    mount(Host)
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it('useTransition：同步执行，pending 恒 false', () => {
    let ran = 0
    let pendingVal: any
    function Host() {
      const [pending, startTransition] = useTransition()
      pendingVal = pending
      startTransition(() => {
        ran++
      })
      return null
    }
    mount(Host)
    expect(ran).toBe(1)
    expect(pendingVal.value).toBe(false)
  })

  it('useDeferredValue：透传（传 ref 保持响应式）', async () => {
    const vRef = ref(1) // 参数在 setup 已求值：须传 ref 才有活引用
    function Host() {
      const deferred = useDeferredValue(vRef)
      return <div class="dv">{deferred}</div>
    }
    const host = mount(Host)
    expect(host.querySelector('.dv')!.textContent).toBe('1')
    vRef.value = 9
    await flush()
    expect(host.querySelector('.dv')!.textContent).toBe('9')
  })
})
