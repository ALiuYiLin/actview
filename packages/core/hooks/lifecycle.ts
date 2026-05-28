/**
 * 生命周期 Hook — onMounted / onBeforeUnmount
 *
 * 在 setup 中调用注册，reconciler 在对应时机执行。
 */

// ======== 组件级生命周期容器 ========

export interface LifecycleHooks {
  created: (() => void)[];
  mounted: ((instance?: any) => void)[];
  beforeUnmount: ((instance?: any) => void)[];
}

let currentHooks: LifecycleHooks | null = null;

export function setCurrentLifecycleHooks(hooks: LifecycleHooks | null) {
  currentHooks = hooks;
}

export function createLifecycleHooks(): LifecycleHooks {
  return { created: [], mounted: [], beforeUnmount: [] };
}

export function getCurrentLifecycleHooks(): LifecycleHooks | null {
  return currentHooks;
}

// ======== 用户注册函数 ========

export function onCreated(fn: () => void) {
  currentHooks?.created.push(fn);
}

export function onMounted(fn: (instance?: any) => void) {
  currentHooks?.mounted.push(fn);
}

export function onBeforeUnmount(fn: (instance?: any) => void) {
  currentHooks?.beforeUnmount.push(fn);
}
