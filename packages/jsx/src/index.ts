// ============================================================
// @actview/jsx — 包入口
// ============================================================

// 引入全局 JSX 类型增强（JSX.IntrinsicElements 等），
// 构建后该副作用 import 会保留在 d.ts 中，消费方加载即全局生效
import './global.js'

export {
  jsx,
  jsxs,
  jsxDEV,
  createElement,
  isValidElement,
  Fragment,
  openBlock,
  setupBlock,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE
} from './jsxFactory.js'

// types.ts 全部为类型定义——用 export *（tsup 多 entry 的 dts 构建
// 对具名类型再导出 `export type {...} from` 解析失败，见 release 修复记录）
export * from './types.js'
