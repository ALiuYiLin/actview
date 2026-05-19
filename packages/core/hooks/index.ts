import { useCurrentUpdateFn } from './use-current-update'
import { injectUpdateFnAccessors, injectDiffFunctions } from '@actview/jsx'
import {
  diff, syncAttributes, syncListeners, syncStyles,
  reconcileChildren, reconcileFragmentChildren
} from '../runtime/diff'

const { getCurrentUpdateFn, setCurrentUpdateFn } = useCurrentUpdateFn()

// 注入到 JSX 工厂，使函数组件能够创建组件级 updateFn
injectUpdateFnAccessors(getCurrentUpdateFn, setCurrentUpdateFn);

// 注入统一的 diff 实现，使 JSX 层使用 core 的增强 diff
injectDiffFunctions({
  diff,
  syncAttributes,
  syncListeners,
  syncStyles,
  reconcileChildren,
  reconcileFragmentChildren,
});

export { useCurrentUpdateFn, getCurrentUpdateFn, setCurrentUpdateFn }
export { useApp } from './use-app'