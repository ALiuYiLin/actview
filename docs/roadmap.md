# 框架能力路线图（Gate / Roadmap）

> 本文盘点 ActView 距离“可发布的前端框架”还缺什么，包含第一版已知限制。
> 状态是盘点，不是承诺排期；已有能力见 [architecture.md](./architecture.md)、[decorators.md](./decorators.md)、[renderer.md](./renderer.md)、[dependency-injection.md](./dependency-injection.md)。

## 1. 当前基线（已有）

- 类组件 + 装饰器组件模型（`@Component` / `@Prop` / `@Ref` / `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject`）；
- 组件内数据层 `@Model` + `@UseModel(Token)`（per-component scope，支持 async `@Setup`、`@Prop`、`@Provide`、`@Setup('pre'|'after')`）；
- 组件级 re-render、微任务调度、`nextTick`（已从 `actview` 导出）；
- keyed children diff + LIS；
- Teleport / Transition / TransitionGroup / KeepAlive / Suspense / lazy / ErrorBoundary / Dynamic；
- 生命周期 hooks、错误传播、DevTools hook / `@actview/devtools` backend + 扩展 v0.1（Components / Events / Performance；基础高亮 / 元素选择）、provide/inject；
- App 插件契约：`app.use` / `app.onUnmount` / `app.config`（devtools / performance / warnHandler）；
- `@actview/router` v1：RouterView/RouterLink、嵌套路由/params/query、guards、lazy、三种 history；
- `@actview/server`：SSR Phase 1–4 基础链路（renderToString / async SSR / hydration / Router SSR / head-state）；
- JSX 类型层与 `@actview/jsx` automatic runtime；
- 构建、类型检查、单元测试、playground。

## 2. 第一版限制

### 2.1 Model / DI 第一版限制

- `@UseModel` 必须显式 token：`@UseModel(CounterData)`，不支持裸 `@UseModel counterData`；
- 支持 component / inherited / app scope 与 `@Named`；app scope 暂不支持 `@Prop` / `@Provide` / async `@Setup`；
- inherited 的生命周期归创建者，消费者不重复 setup/hooks；
- Model 构造函数必须无参；
- Model `@Prop` 是 owner 组件同名 `@Prop` 的只读投影；组件必须声明；
- `pre` Model 不能依赖 `after` Model（阶段冲突报错）；
- 循环依赖直接报错，不做代理；
- Model 状态已可被 DevTools backend 读取；Model 依赖图 UI 尚未实现。

### 2.2 组件 / 运行时第一版限制

- 组合约定：**不做 slots**——组件通过 props 传组件构造器、render function 或 `children` 组合；
- 组件 ref：使用显式 `ref={(el) => ...}` callback，父组件持有类实例；**不做 `defineExpose`**；
- 无组件 emits / `$attrs` / `$emit`；
- `@Prop` 无 required / default / validator / 类型运行时告警；
- 无 TransitionGroup 的 move 动画（enter/leave 已有）；
- `app.component` / `app.directive` 尚未实现（`app.use` / `app.config` 已有；见 [plugins.md](./plugins.md)）。

### 2.3 平台 / 工程限制

- 无 SSR / hydrate / `renderToString` / streaming；
- 无 HMR、Vite 开发插件、错误 overlay；
- 无官方测试工具包（当前测试是仓库内部测试）；
- 无 CLI / 脚手架 / 文档站；DevTools 扩展仅基础 Components / Events / Performance；
- 仅 DOM 渲染器，没有 `createRenderer` 自定义平台抽象；
- 装饰器为 legacy（`experimentalDecorators`），未迁移 Stage 3；
- `patchComponent` / `patchElement` 仍内聚在 `runtime/patch/index.ts`（`patchProps` 已独立）。

## 3. P0：框架核心 API 完整性

1. **组件事件**：`emits` 声明、`$emit`、父组件监听、事件类型。
2. **`$attrs` / 属性透传**：未声明 props 的属性落到根节点；`inheritAttrs`。
3. **Props 运行时能力**：required / default / validator / 类型告警。
4. **公开 API 补齐**：`$attrs` / `$emit` / `$refs` 语义完整；明确内部 API 边界。
5. **全局注册表**：`app.component` + `Dynamic` 字符串解析；`app.directive` 等 JSX 指令语法确定后再做。

## 4. P1：生产可用性

10. **SSR / Hydration**
    - 已完成基础链路：`renderToString` / `renderToHTML` / `renderToStream`、async setup / lazy / Suspense、ErrorBoundary、基础 hydration、Router SSR + route loader、head/state、renderDocument；
    - 待做：复杂嵌套 Teleport / Suspense fallback 边界、完整 mismatch 恢复、streaming hydration/out-of-order、SSR 测试矩阵。
11. **HMR 与开发体验**
    - Vite 插件：HMR、组件/Model 状态保留、错误 overlay、source map；
    - 开发警告、生产裁剪、组件栈定位。
12. **路由**
    - v1 已完成（RouterView/RouterLink、嵌套、params/query、guards、lazy、history）；
    - 待做：命名视图、in-component guards、scrollPosition、SSR/数据预取、KeepAlive/Transition 组合。
13. **官方测试工具**
    - `mount` / `trigger` / `flushPromises` / DOM 断言；
    - SSR、异步组件、ErrorBoundary、KeepAlive 测试基建。
14. **错误恢复**
    - ErrorBoundary 重试/重置；async setup 取消/超时；errorCaptured 完整传播。
15. **DevTools**
    - backend + Chrome 扩展 v0.1：组件树、props/state/computed/Model、track/trigger、性能、DOM 高亮、元素选择；
    - 待做：搜索、依赖图、状态编辑、时间旅行、源码定位、多 frame、扩展打包。

## 5. P2：DOM / 渲染器硬化

16. **表单与受控组件**：input/textarea/select 的 value/checked、光标位置、IME/composition、文件输入。
17. **DOM 边界**：SVG/MathML、custom elements、style 前缀/CSS 变量、事件选项/清理、`innerHTML` 安全告警。
18. **内置组件边界**：Teleport 多目标/SSR、KeepAlive × Transition、Suspense 嵌套/超时。
19. **调度与异步**：更新优先级、嵌套更新、卸载取消异步任务、内存泄漏、性能基准。
20. **平台抽象**：`createRenderer` / host API（Canvas、Native、测试渲染器）。

## 6. P3：生态与工程化

21. **CLI / 脚手架**：`create-actview`、模板、升级命令。
22. **文档与示例**：API reference、教程、迁移指南、在线 playground。
23. **生态包**：数据请求/缓存、表单校验、i18n、状态管理、UI 组件库。
24. **发布与质量**：ESM/CJS/类型产物、tree-shaking/sideEffects、浏览器/Node 支持矩阵、CI/E2E/视觉回归/bundle size、changesets 发布、装饰器 Stage 3。

## 7. 建议顺序

如果只先做三件事：

1. **emits + `$attrs` + props 校验**（组件模型闭环）；
2. **官方测试工具 + 全局组件注册表**（可被应用和生态使用）；
3. **SSR/hydration 或 HMR/Vite 插件** 二选一先做（部署能力 vs 开发体验）。

路由、DevTools、CLI、生态包可以在独立包中并行推进，不阻塞 core。

## 8. 相关文档

- [architecture.md](./architecture.md) — 包结构 / 公开边界
- [decorators.md](./decorators.md) — 类组件与装饰器
- [dependency-injection.md](./dependency-injection.md) — Model / @UseModel 设计与限制
- [plugins.md](./plugins.md) — App 插件契约与官方插件规划
- [renderer.md](./renderer.md) — 渲染器现状与限制
- [build.md](./build.md) — 构建链
