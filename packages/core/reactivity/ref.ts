import { Ref } from "../types";
import { eventBus } from "./event";
import { getCurrentUpdateFn } from "../hooks";
export function ref<T>(value: T, _debug?: string): Ref<T> {
  const obj: any = { value, __isRef: true };
  if (_debug) obj._debug = _debug;
  const state = new Proxy(obj, {
    set: (target, key, value) => {
      if (key === "value") {
        target[key] = value;
        eventBus.publish(state);
      }
      return true;
    },
    get: (target, key) => {
      const currentUpdateFn = getCurrentUpdateFn();
      if (key === "value" && currentUpdateFn) {
        eventBus.subscribe(state, currentUpdateFn);
      }
      return target[key as keyof typeof target];
    },
  }) as Ref<T>;
  return state;
}