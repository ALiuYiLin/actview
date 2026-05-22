import { getAppInstance, App } from "../runtime/app";

export function useApp(): App {
  const instance = getAppInstance();
  if (!instance) {
    throw new Error("App instance not created yet. Call `new App()` first.");
  }
  return instance;
}
