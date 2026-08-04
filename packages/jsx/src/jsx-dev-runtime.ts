// JSX automatic transform runtime（开发）
// 副作用引用 global：让 jsxImportSource 消费方加载 JSX 全局类型（IntrinsicElements 等）
import './global.js'
export { jsxDEV, Fragment } from './jsxFactory.js'
