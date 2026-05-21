import { useCurrentUpdateFn } from './use-current-update'
import { useCurrentInstance } from './use-current-instance'
import { injectUpdateFnAccessors, injectCurrentInstanceAccessors, injectUnsubscribe } from '@actview/jsx'
import { eventBus } from '../reactivity/event'

const { getCurrentUpdateFn, setCurrentUpdateFn } = useCurrentUpdateFn()
const { getCurrentInstance, setCurrentInstance } = useCurrentInstance()

// 注入到 JSX 工厂，使函数组件能够创建组件级 updateFn
injectUpdateFnAccessors(getCurrentUpdateFn, setCurrentUpdateFn);

// 注入当前组件实例的 getter/setter
injectCurrentInstanceAccessors(getCurrentInstance as () => any, setCurrentInstance);

// 注入组件卸载时的取消订阅能力
injectUnsubscribe((callback, refs) => eventBus.unsubscribe(callback, refs as Set<any>));

export { useCurrentUpdateFn, getCurrentUpdateFn, setCurrentUpdateFn }
export { useCurrentInstance, getCurrentInstance, setCurrentInstance }
export { useApp } from './use-app'