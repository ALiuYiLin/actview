// ============================================================
// 组件定义包装器
// Babel 插件将 function Component() 转为 defineComponent(...)
// ============================================================

export function defineComponent(setup: (...args: any[]) => any) {
  return { __setup: setup }
}
