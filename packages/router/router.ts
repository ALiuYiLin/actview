import { ref, computed, Ref } from "@actview/core";
import { RouteRecord, RouterOptions } from "./types";

let routerInstance: Router | null = null;

/**
 * 递归查找匹配当前路径的路由链（从父到子）
 */
function matchRoutes(routes: RouteRecord[], path: string): RouteRecord[] {
  for (const r of routes) {
    if (r.path === path) return [r];
    if (r.children && path.startsWith(r.path + "/")) {
      const childMatch = matchRoutes(r.children, path);
      if (childMatch.length > 0) return [r, ...childMatch];
    }
  }
  // 第二遍：在 children 中精确查找（处理绝对路径子路由）
  for (const r of routes) {
    if (r.children) {
      const childMatch = matchRoutes(r.children, path);
      if (childMatch.length > 0) return childMatch;
    }
  }
  return [];
}

export class Router {
  private routes: RouteRecord[] = [];
  private currentPath: Ref<string> = ref(location.pathname);
  /** 当前路由的叶子节点（兼容旧用法） */
  readonly route!: Ref<RouteRecord | null>;
  /** 当前路径匹配的路由链（从父到子） */
  readonly matched!: Ref<RouteRecord[]>;

  /** 嵌套 RouterView 深度栈 */
  private _depthStack: number[] = [0];

  constructor(options: RouterOptions) {
    if (routerInstance) return routerInstance;

    this.routes = options.routes;
    this.currentPath = ref(location.pathname);

    const matched = computed(() => matchRoutes(this.routes, this.currentPath.value));
    this.matched = matched;

    this.route = computed(() => {
      const m = matched.value;
      return m.length > 0 ? m[m.length - 1] : null;
    });

    window.addEventListener("popstate", () => this.update());
    routerInstance = this;
  }

  push(path: string) {
    history.pushState(null, "", path);
    this.update();
  }

  replace(path: string) {
    history.replaceState(null, "", path);
    this.update();
  }

  /** 获取当前 RouterView 嵌套深度 */
  getCurrentDepth(): number {
    return this._depthStack[this._depthStack.length - 1];
  }

  /** 进入嵌套 RouterView 前推入深度 */
  pushDepth(): void {
    this._depthStack.push(this._depthStack.length);
  }

  /** 退出嵌套 RouterView 后弹出深度 */
  popDepth(): void {
    this._depthStack.pop();
  }

  private update() {
    this.currentPath.value = location.pathname;
  }

  /** 获取全局 Router 单例 */
  static getInstance(): Router {
    if (!routerInstance) throw new Error("Router not initialized");
    return routerInstance;
  }
}

export function useRouter(): Router {
  if (!routerInstance) {
    throw new Error("Router instance not created yet. Call `new Router(options)` first.");
  }
  return routerInstance;
}
