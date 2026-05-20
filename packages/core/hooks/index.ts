import { useCurrentUpdateFn } from './use-current-update'
import { injectUpdateFnAccessors } from '@actview/jsx'

const { getCurrentUpdateFn, setCurrentUpdateFn } = useCurrentUpdateFn()

// 注入到 JSX 工厂，使函数组件能够创建组件级 updateFn
injectUpdateFnAccessors(getCurrentUpdateFn, setCurrentUpdateFn);

export { useCurrentUpdateFn, getCurrentUpdateFn, setCurrentUpdateFn }
export { useApp } from './use-app'