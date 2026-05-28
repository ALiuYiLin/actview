import type { VNode } from '@actview/jsx';

/**
 * 路由组件类型，支持两种模式：
 * - 直接模式：() => VNode
 * - Setup 模式：() => () => VNode（函数组件返回 render 函数）
 */
export type RouteComponent = () => VNode | (() => VNode);

export interface RouteRecord {
  path: string;
  component: RouteComponent;
  children?: RouteRecord[];
}

export interface RouterOptions {
  routes: RouteRecord[];
}
