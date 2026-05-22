import { getCurrentUpdateFn, setCurrentUpdateFn } from "../hooks"

/**
 * 监听响应式数据的变化，当数据变化时，调用回调函数
 * @param callback
 */
export function watchEffect(callback: () => void) {
  const prev = getCurrentUpdateFn()
  setCurrentUpdateFn(callback)
  callback()
  setCurrentUpdateFn(prev)
}