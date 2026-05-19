type DOMResult = string | HTMLElement | Text | DocumentFragment | SVGElement;

/**
 * 路由组件类型，支持两种模式：
 * - 直接模式：() => DOM
 * - Setup 模式：() => () => DOM（函数组件返回 render 函数）
 */
export type RouteComponent = () => DOMResult | (() => DOMResult);

export interface RouteRecord {
  path: string;
  component: RouteComponent;
  children?: RouteRecord[];
}

export interface RouterOptions {
  routes: RouteRecord[];
}
