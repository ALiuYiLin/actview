/**
 * Reactive 上下文工具
 *   - withReactiveContext: 在指定组件的 reactive 上下文中执行 fn
 *   - createCompInstance: 组件实例（仅用于收集 refs 做卸载清理）
 */

import { getCurrentUpdateFn, setCurrentUpdateFn, getCurrentInstance, setCurrentInstance } from '../hooks';

/**
 * 在指定组件的 reactive 上下文中执行 fn
 * 执行期间 ref 的读操作会被收集到该组件的 updateFn 上
 */
export function withReactiveContext<T>(
  updateFn: (() => void) | null,
  instance: { refs: Set<any> },
  fn: () => T,
): T {
  const prevFn = getCurrentUpdateFn();
  setCurrentUpdateFn(updateFn);
  const prevInst = getCurrentInstance();
  setCurrentInstance(instance);
  const result = fn();
  setCurrentInstance(prevInst);
  setCurrentUpdateFn(prevFn);
  return result;
}

/** 创建组件实例对象 */
export function createCompInstance(): { refs: Set<any> } {
  return { refs: new Set<any>() };
}
