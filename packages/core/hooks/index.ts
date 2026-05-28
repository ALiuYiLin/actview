import { useCurrentUpdateFn } from './use-current-update'
import { useCurrentInstance } from './use-current-instance'

const { getCurrentUpdateFn, setCurrentUpdateFn } = useCurrentUpdateFn()
const { getCurrentInstance, setCurrentInstance } = useCurrentInstance()


export { useCurrentUpdateFn, getCurrentUpdateFn, setCurrentUpdateFn }
export { useCurrentInstance, getCurrentInstance, setCurrentInstance }
export { useApp } from './use-app'
export {
  onCreated,
  onMounted,
  onBeforeUnmount,
  setCurrentLifecycleHooks,
  createLifecycleHooks,
  getCurrentLifecycleHooks,
} from './lifecycle'