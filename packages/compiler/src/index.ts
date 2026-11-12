// ============================================================
// @actview/compiler — L1 组件包装已移除（第一版类组件重构）
//
// 组件现在由运行时直接识别 @Component 类，不再需要编译期把函数包成
// defineComponent(setup)。Babel 依赖仍保留（装饰器降级 / 后续静态分析），
// 但本包不再导出组件包装或 JSX 转换 API。
//
// 组件写法见 docs/class-component-design.md；JSX 降级仍由宿主 automatic
// runtime 完成（tsconfig: jsx: react-jsx + jsxImportSource @actview/jsx）。
// ============================================================

export {}
