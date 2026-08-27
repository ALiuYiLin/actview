---
'@actview/plugin-babel': major
---

setup 风格（组件体内 return 渲染函数）改为**编译期直接报错**

- 组件嵌套方案此前已废弃，但插件静默放过、错误拖到运行时才暴露（render is not a function）；现在在 babel transform 阶段抛错并给代码帧定位与改法提示（`✗ return () => <jsx/> → ✓ return <jsx/>`）。
- 覆盖三种入口（函数声明 / 变量赋值 / 默认导出）与任意位置的早退 return；具名 PascalCase 组件一律报错；匿名默认导出仅在闭包内含 JSX/`_jsx` 时报错，纯回调工厂放行。
- 升级注意：存量代码若使用 `function App(){ return () => <jsx/> }` 手写渲染闭包，升级后将无法编译——请迁移为官方简写或 defineComponent 手动包装。详见 docs/babel-defineComponent.md「三元链至少一个字面 JSX 分支」的经验注记。
