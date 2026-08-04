// ============================================================
// 组件定义包装器
// Babel 插件将 function Component() 转为 defineComponent(...)
// ============================================================

/**
 * 返回 { __setup }，并在类型层面伪装一个 call signature：
 * 让 defineComponent 产物（如手写 RouterView）能通过 JSX 类型检查，
 * 运行时仍是普通对象（as 断言不产生任何运行时代码）。
 */
export function defineComponent<Setup extends (...args: any[]) => any>(setup: Setup) {
  return { __setup: setup } as { __setup: Setup } & ((...args: Parameters<Setup>) => ReturnType<Setup>)
}
