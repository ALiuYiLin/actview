// ============================================================
// scoped CSS 的类型声明
// import './index.css?scoped' 触发 scoped（@actview/plugin-scoped）
// ============================================================

declare module '*.css?scoped' {
  const css: string
  export default css
}
