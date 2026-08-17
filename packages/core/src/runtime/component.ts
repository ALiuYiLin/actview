// ============================================================
// 组件定义包装器
// Babel 插件将 function Component() 转为 defineComponent(...)
// 语义对齐 React：setup(props) 收到全部传入属性（key/ref 除外），
// 无 props/attrs 分离、无自动透传（用户显式 {...props} 选择继承）。
// ============================================================

/** setup 上下文：注入表（provide/inject） */
export interface SetupContext {
  /** 注入表：继承自最近提供方（未使用 provide 的组件共享父引用，零拷贝）。
   *  键可为 string（provide）或 symbol（createContext 上下文） */
  injects: Record<PropertyKey, any>
}

/** options 形态的组件定义 */
export interface ComponentOptions<Props = Record<string, any>> {
  setup: (props: Props, ctx: SetupContext) => any
  /** 组件名（KeepAlive include/exclude、DevTools 等用） */
  name?: string
}

type ComponentOptionsResult<Props> = {
  __setup: (props: Props, ctx: SetupContext) => any
  name?: string
} & ((props: Props & Record<string, any>) => any)

/**
 * defineComponent(options)：对象形态（setup(props, ctx)）。
 * 产物 { __setup }，类型层面伪装 call signature：
 * 让产物能通过 JSX 类型检查，运行时仍是普通对象（as 断言无运行时代码）。
 */
export function defineComponent<Props = Record<string, any>>(
  options: ComponentOptions<Props>,
  name?: string
): ComponentOptionsResult<Props>

/**
 * defineComponent(setup)：函数形态。产物 { __setup }。
 */
export function defineComponent<Setup extends (...args: any[]) => any>(
  setup: Setup,
  name?: string
): {
  __setup: Setup
  name?: string
} & ((...args: Parameters<Setup>) => ReturnType<Setup>)

export function defineComponent(opt: any, name?: string) {
  if (typeof opt === 'function') {
    const out: any = { __setup: opt }
    if (name) out.name = name
    else if (opt.name) out.name = opt.name
    return out
  }
  const out: any = { __setup: opt.setup }
  if (name) out.name = name
  else if (opt.name) out.name = opt.name
  return out
}
