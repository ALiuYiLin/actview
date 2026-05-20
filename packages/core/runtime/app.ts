import { compile } from "./compile";
import { RenderFn } from "../types";

let appInstance: App | null = null;

export function getAppInstance(): App | null {
  return appInstance;
}

export class App {
  constructor() {
    if (appInstance) return appInstance;
    appInstance = this;
  }

  use(render: RenderFn): this {
    return this;
  }

  mount(selector: string, component: () => any): this {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`mount target not found: ${selector}`);
    compile(el, component);
    return this;
  }
}
