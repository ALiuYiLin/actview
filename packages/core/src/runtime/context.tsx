// ============================================================
// createContext — 上下文（对象身份即键，无字符串碰撞）
//
//   const ThemeCtx = createContext(defaultTheme)
//
//   // Provider（两种写法等价）：
//   //   <ThemeCtx.Provider value={state}>...</ThemeCtx.Provider>
//   //   <ThemeCtx value={state}>...</ThemeCtx>          （React 19 风格）
//   // 消费：
//   //   const state = ThemeCtx.use()
//   //   return <div class={state.theme}>{...}</div>     // render 里读响应式
//   //                                                   // 数据建立追踪
//
// 契约（store-as-is，对齐 Vue provide/inject 本源语义）:
//   - provide 只做「原样存储」——不包 ref、不建内部 state、不 watch 同步。
//   - 想要响应式？把【响应式的东西】传进来并在树中保持引用稳定:
//       · reactive 对象        <Ctx.Provider value={state} />
//       · ref 装在对象/数组里   <Ctx.Provider value={{ count }} />
//       · ref 本体直传          <Ctx.Provider value={rawRef(count)} />
//         （⚠️ value={count} 会被 jsxFactory 的顶层 ref 解包变成值快照——
//          这是 jsxFactory 的通用行为,与 context 无关;要传 ref 本体用
//          rawRef 或对象携带）
//   - 消费端在 render（JSX）里读取这些响应式数据 → 依赖自动收集 →
//     数据变化自动触发更新。框架在此层【零包装、零监听】。
//   - 就近覆盖:内层 Provider 覆盖外层（injects 链 + copy-on-write）。
//   - 无 Provider 时返回 defaultValue（原样）。
//
// ⚠️ 语义变更（2026-08，破坏性）:旧实现把 value 包一层内部 ref 并 watch
//    props.value 同步——那是在为「传快照值」兜底,并因此引入过真实缺陷
//    （plantform-diff.md:383 combobox 惰性 computed 事故）。新契约下:
//    传快照值 = 注入静态值（仅重挂载可读新值）;动态值必须传响应式引用。
// ============================================================

import { defineComponent } from './component'
import { getCurrentInstance, provide } from './lifecycle'

/** 上下文对象：本身可直接作组件（<Ctx value=...>），也可 .Provider / .use() */
export interface Context<T> {
  /** 内部唯一键（Symbol）：对象身份即键 */
  readonly _key: symbol
  /** <Ctx value={v}> 直接作组件用（React 19 风格）：提供值 */
  __setup: (props: any, ctx: any) => any
  name?: string
  /** <Ctx.Provider value={v}> 经典风格：与直接作组件等价 */
  Provider: Context<T>
  /** 消费：返回注入表中【原样存储的值】——响应式来源由使用方保证
   *  （传 reactive 对象/ref 本体/装 ref 的容器），render 里读取即建立追踪。
   *  无 Provider 时返回 defaultValue（原样）。 */
  use: () => T
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

  // Provider 组件：setup 期把 value 【原样】存入注入表（零包装）。
  // 动态值请传响应式引用（reactive 对象 / 装ref的容器 / rawRef）——
  // 消费端读取时自动收集依赖,数据变化自动触发更新。
  // （不要在此处 watch props.value 回写注入表：注入表在子组件 setup 时
  //   被 copy-on-write 快照,回写既不完整也不必要——见文件头契约说明）
  const provider = defineComponent(function (props: { value?: T; children?: any }) {
    provide(key, props.value ?? defaultValue)
    return () => <>{props.children ?? null}</>
  }, 'ActViewContext.Provider')

  const ctx: Context<T> = {
    _key: key,
    __setup: (provider as any).__setup,
    name: 'ActViewContext',
    Provider: provider as any,
    use() {
      const instance = getCurrentInstance()
      return instance?.injects?.[key] ?? defaultValue
    },
  } as Context<T>
  return ctx
}
