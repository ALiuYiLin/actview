// ============================================================
// 组件定义包装器
// Babel 插件将 function Component() 转为 defineComponent(...)
// ============================================================

/** options 形态的 setup 上下文：props 白名单外的属性（attrs） */
export interface SetupContext {
  attrs: Record<string, any>
  /** 注入表：继承自最近提供方（未使用 provide 的组件共享父引用，零拷贝） */
  injects: Record<string, any>
}

/** options 形态的组件定义（对齐 Vue options API 的 props 分离语义） */
export interface ComponentOptions<Props = Record<string, any>> {
  /** props 白名单：声明内的属性进 setup.props，声明外的进 ctx.attrs */
  props?: readonly string[]
  setup: (props: Props, ctx: SetupContext) => any
  /** 默认 true：attrs 自动合并到单根元素；false 时需显式 {...ctx.attrs} 绑定 */
  inheritAttrs?: boolean
}

type ComponentOptionsResult<Props> = {
  __setup: (props: Props, ctx: SetupContext) => any
  __props?: readonly string[]
  __inheritAttrs?: boolean
} & ((props: Props & Record<string, any>) => any)

/**
 * defineComponent(options)：对象形态（props 白名单分离 + ctx.attrs）。
 * 产物 { __setup, __props?, __inheritAttrs? }，类型层面伪装 call signature：
 * 让产物能通过 JSX 类型检查，运行时仍是普通对象（as 断言无运行时代码）。
 */
export function defineComponent<Props = Record<string, any>>(
  options: ComponentOptions<Props>
): ComponentOptionsResult<Props>

/**
 * defineComponent(setup)：函数形态（无 props 声明，全量属性走 attrs ——
 * Vue 无声明语义）。产物 { __setup }。
 */
export function defineComponent<Setup extends (...args: any[]) => any>(
  setup: Setup
): {
  __setup: Setup
} & ((...args: Parameters<Setup>) => ReturnType<Setup>)

export function defineComponent(opt: any) {
  if (typeof opt === 'function') {
    return { __setup: opt }
  }
  const { props, setup, inheritAttrs } = opt
  const out: any = { __setup: setup }
  if (props && props.length) out.__props = props
  if (inheritAttrs === false) out.__inheritAttrs = false
  return out
}
