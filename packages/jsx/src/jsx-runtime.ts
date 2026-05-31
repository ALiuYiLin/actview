// ============================================================
// @actview/jsx/jsx-runtime
// 生产环境 JSX 运行时入口
// tsconfig.json jsx: "react-jsx" / jsxImportSource: "@actview/jsx"
// 时自动导入此模块
// ============================================================
export { jsx, jsxs } from './jsx'
export type { VNode, VNodeChildren, VNodeKey, VNodeChild } from './types'
