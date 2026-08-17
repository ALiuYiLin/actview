// ============================================================
// createContext — React 风格上下文（对象身份即键，无字符串碰撞）
//
//   const ThemeCtx = createContext('default')
//
//   // Provider（两种写法等价）：
//   //   <ThemeCtx.Provider value="dark">...</ThemeCtx.Provider>
//   //   <ThemeCtx value="dark">...</ThemeCtx>          （React 19 风格）
//   // 消费：
//   //   const theme = ThemeCtx.use()
//   //   return <div class={theme.value}>{...}</div>    // render 里读 .value 建立追踪
//
// 与 provide/useInjects 的区别：
//   - 键 = createContext 返回对象的内部 Symbol，天然唯一（字符串键需手动防碰撞）
//   - 响应式：Provider 的 value prop 变化 → watch 同步内部 ref → 消费方 render
//     effect 被触发重渲染（对齐 React 语义；provide 是传快照值，需自己传 ref）
//   - 就近覆盖：内层 Provider 覆盖外层（依赖现有 injects 链 + copy-on-write，
//     object spread 会复制 Symbol 键，COW 不丢外层上下文）
//   - 无 Provider 时返回默认值 ref（模块级共享，永不被写入）
// ============================================================

import { defineComponent } from './component'
import { getCurrentInstance, provide } from './lifecycle'
import { ref, type Ref } from '../reactivity/ref'
import { watch } from '../reactivity/watch'

/** 上下文对象：本身可直接作组件（<Ctx value=...>），也可 .Provider / .use() */
export interface Context<T> {
  /** 内部唯一键（Symbol）：对象身份即键 */
  readonly _key: symbol
  /** <Ctx value={v}> 直接作组件用（React 19 风格）：提供值 */
  __setup: (props: any, ctx: any) => any
  name?: string
  /** <Ctx.Provider value={v}> 经典风格：与直接作组件等价 */
  Provider: Context<T>
  /** 消费：返回当前上下文值的 Ref。无 Provider 时返回默认值 ref；
   *  在 render（JSX）里读 .value 建立追踪，Provider value 变化自动重渲染 */
  use: () => Ref<T>
  /** 类型层面伪装 call signature，让 <Ctx value=...> 通过 JSX 类型检查（运行时无此调用） */
  (props: { value?: T; children?: any }): any
}

/**
 * 创建上下文：返回对象即键（内部 Symbol），消费用返回值的 .use()。
 * defaultValue 仅在无 Provider 时生效。
 */
export function createContext<T>(defaultValue: T): Context<T> {
  // 唯一键：Symbol 不参与 for...in / Object.keys，对 useInjects() 全表读取不可见，
  // 与字符串键的 provide 完全隔离（无碰撞）
  const key: symbol = Symbol('actview-context')
  // 无 Provider 时的兜底 ref（每个上下文一份，永不被写入）
  const fallback = ref<T>(defaultValue)

  // Provider 组件：setup 创建 state ref 并注入，watch 同步 value prop 变化
  const provider = defineComponent(function (props: { value?: T; children?: any }) {
    const state = ref<T>(props.value ?? defaultValue)
    provide(key, state)
    // value prop 变化 → 同步 state → 消费方 render effect 被触发（React 语义）。
    // 不加 immediate：初始值已在 ref 构造时写入（避免 value 缺失时 undefined 覆盖默认值）
    watch(() => props.value, (v) => {
      state.value = v
    })
    return () => props.children ?? null
  }, 'ActViewContext.Provider')

  const ctx: Context<T> = {
    _key: key,
    __setup: (provider as any).__setup,
    name: 'ActViewContext',
    Provider: provider as any,
    use() {
      const instance = getCurrentInstance()
      const injected = instance?.injects?.[key] as Ref<T> | undefined
      return injected ?? fallback
    },
  } as Context<T>
  return ctx
}
