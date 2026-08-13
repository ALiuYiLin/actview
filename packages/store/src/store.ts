// ============================================================
// @actview/store — 组合式状态管理（对齐 Pinia setup store，TSX 风格）
//   defineStore(id, setup)：定义 store，setup 返回 state + actions
//   - 单例：同 id 多次调用 useStore 返回同一实例（跨模块复用）
//   - 响应式：setup 内用 reactive/computed，组件读取自动追踪
//   - 类型推导：useStore() 返回类型 = setup 返回类型（零样板）
//   - 插件：applyPlugin(fn)，store 创建时调用（持久化/订阅/DevTools 注册）
//   - reset：重新执行 setup
// ============================================================

export interface StoreContext {
  /** store 唯一 id */
  id: string
  /** setup 返回的状态对象（含 reactive state + actions） */
  state: any
}

export type StorePlugin = (ctx: StoreContext) => void

const registry = new Map<string, StoreContext>()
const plugins: StorePlugin[] = []

/** 注册插件：之后创建的 store 会调用（对已创建的 store 不生效） */
export function applyPlugin(plugin: StorePlugin): void {
  plugins.push(plugin)
}

/**
 * 定义 store：返回 useStore 函数（单例，懒创建）。
 *
 * ```ts
 * const useCounter = defineStore('counter', () => {
 *   const state = reactive({ count: 0 })
 *   const double = computed(() => state.count * 2)
 *   function inc() { state.count++ }
 *   return { state, double, inc }
 * })
 *
 * const counter = useCounter()  // 首次调用创建，之后复用同一实例
 * counter.inc()
 * ```
 */
export function defineStore<Setup extends () => any>(
  id: string,
  setup: Setup
): (() => ReturnType<Setup>) & { $id: string } {
  const useStore = () => {
    let inst = registry.get(id)
    if (!inst) {
      const state = setup()
      inst = { id, state }
      registry.set(id, inst)
      for (const p of plugins) p(inst)
    }
    return inst.state as ReturnType<Setup>
  }
  ;(useStore as any).$id = id
  return useStore as any
}

/** 重置指定 store：下次 useStore 时重新执行 setup */
export function resetStore(id: string): void {
  registry.delete(id)
}

/** 重置所有 store */
export function resetAllStores(): void {
  registry.clear()
}

/** 当前已创建的 store id 列表（DevTools / 调试用） */
export function getActiveStoreIds(): string[] {
  return [...registry.keys()]
}

/** 获取 store 实例（未创建返回 undefined） */
export function getStore(id: string): StoreContext | undefined {
  return registry.get(id)
}
