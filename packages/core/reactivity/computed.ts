import { Ref } from "../types";
import { ref } from "./ref"
import { getCurrentUpdateFn, setCurrentUpdateFn } from "../hooks"

export function computed<T>(computedFn: ()=> T): Ref<T>{
  const computedRef = ref<T | null>(null)
  const prevFn = getCurrentUpdateFn()
  const updateFn = ()=> {
    computedRef.value = computedFn()
  }
  setCurrentUpdateFn(updateFn)
  updateFn()
  setCurrentUpdateFn(prevFn)
  return computedRef as Ref<T>
}
