// ============================================================
// useProp / useProps — props 响应式取值 + 默认值/转换
//
//   // 组件内（单参形式：自动取当前实例的 props，少写一个参数）
//   const { variant, rest } = useProps({
//     variant: (v) => v ?? 'default',   // normalize：undefined/null → 默认值
//     size: (v) => v ?? 'md',
//     class: undefined,                 // 裸透传：直接返回 props.class 原值
//   })
//   const size = useProp('size', (v) => v ?? 'md')   // 单键单参形式
//
//   // setup 外 / 显式指定（双参形式）
//   const { variant } = useProps(props, { variant: (v) => v ?? 'default' })
//   const size = useProp(props, 'size', (v) => v ?? 'md')
//
// 解决 setup 快照问题：setup 只执行一次且读取不收集依赖，顶部解构
// props 得到的是永久快照。本 API 返回的均为 ComputedRef（活引用）：
//   - normalize 在 computed getter 内惰性求值，读取 props[key] 时
//     追踪依赖——父组件改 prop → 置脏 → render 重读时取新值；
//   - normalize 里读其他响应式状态（ref / 其他 props）会自动建立
//     派生依赖（computed 的特性，非副作用）；
//   - map 值为 undefined（或省略 normalize）时等价裸透传：直接返回
//     props[key] 原值，无需写 (val) => val；
//   - rest：map 中未声明的 props 键集合（值形态，可直接
//     {...rest.value} 展开），父组件新增的 prop 键也会自动出现。
// ============================================================

import { computed } from '../reactivity/computed'
import type { ComputedRef } from '../reactivity/computed'
import { getCurrentInstance } from './lifecycle'

/** normalize：原始 prop 值 → 目标值（可做默认值兜底 / 类型转换 / 映射） */
type Normalizer<T = any> = (val: any) => T

/** useProps 的返回值：map 内每个键 → 对应 ComputedRef；undefined（裸透传）→ ComputedRef<any> */
type UsePropsResult<M extends Record<string, Normalizer | undefined>> = {
  [K in keyof M]: M[K] extends Normalizer<infer T> ? ComputedRef<T> : ComputedRef<any>
} & { rest: ComputedRef<Record<string, any>> }

/** 单参形式取当前组件实例的 props（setup 执行期间 currentInstance 已设置） */
function currentInstanceProps(): Record<string, any> {
  const instance = getCurrentInstance()
  if (!instance || !instance.props) {
    throw new Error(
      '[actview] useProp/useProps 单参形式只能在组件 setup 中调用（组件外请显式传入 props）',
    )
  }
  return instance.props
}

/**
 * 单个 prop 的响应式取值。normalize 缺省（undefined）时等价于
 * `toRef(props, key)`（原始值，不做默认值处理）。
 *
 * 两种调用形式：
 *   useProp('variant', fn?)          // 组件内：props 取自当前实例
 *   useProp(props, 'variant', fn?)   // 显式传入 props
 */
export function useProp<T = any>(key: string, normalize?: Normalizer<T>): ComputedRef<T>
export function useProp<T = any>(
  props: Record<string, any>,
  key: string,
  normalize?: Normalizer<T>
): ComputedRef<T>
export function useProp(...args: any[]): ComputedRef<any> {
  const [a, b, c] = args
  const auto = typeof a === 'string' // 单参形式：首参是 key
  const props = auto ? currentInstanceProps() : a
  const key = auto ? a : b
  const normalize = auto ? b : c
  return computed(() => (typeof normalize === 'function' ? normalize(props[key]) : props[key]))
}

/**
 * 批量 props 响应式取值：map 声明「键 → normalize」，返回同名 ComputedRef
 * 集合 + `rest`（未声明键的剩余 props 值集合，可直接展开透传）。
 * map 值为 undefined 时该键裸透传（直接返回 props 原值）。
 * `rest` 为保留名：map 中声明 rest 键会被返回的 rest 覆盖。
 *
 * 两种调用形式：
 *   useProps({ key: fn })        // 组件内：props 取自当前实例
 *   useProps(props, { key: fn }) // 显式传入 props
 */
export function useProps<M extends Record<string, Normalizer | undefined>>(map: M): UsePropsResult<M>
export function useProps<M extends Record<string, Normalizer | undefined>>(
  props: Record<string, any>,
  map: M
): UsePropsResult<M>
export function useProps(...args: any[]): any {
  const props = args.length === 1 ? currentInstanceProps() : args[0]
  const map = args.length === 1 ? args[0] : args[1]
  const named: any = {}
  for (const key in map) {
    const fn = map[key]
    named[key] = computed(() => (typeof fn === 'function' ? fn(props[key]) : props[key]))
  }
  const rest = computed(() => {
    const out: Record<string, any> = {}
    for (const key in props) {
      if (!(key in map)) out[key] = props[key]
    }
    return out
  })
  return { ...named, rest }
}
