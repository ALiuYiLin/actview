# 框架能力路线图（Gate / Roadmap）

> 本文盘点 ActView 距离“可发布的前端框架”还缺什么，包含第一版已知限制。
> 状态是盘点，不是承诺排期；已有能力见 [architecture.md](./architecture.md)、[decorators.md](./decorators.md)、[renderer.md](./renderer.md)、[dependency-injection.md](./dependency-injection.md)。

## 1. 当前基线（已有）

- 类组件 + 装饰器组件模型（`@Component` / `@Prop` / `@Ref` / `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject`）；
- 组件内数据层 `@Model` + `@UseModel(Token)`（per-component scope，支持 async `@Setup`、`@Prop`、`@Provide`、`@Setup('pre'|'after')`）；
- 组件级 re-render、微任务调度、`nextTick`；
- keyed children diff + LIS；
- Teleport / Transition / KeepAlive / Suspense / lazy / ErrorBoundary；
- 生命周期 hooks、错误传播、DevTools hook、provide/inject；
- JSX 类型层与 `@actview/jsx` automatic runtime；
- 构建、类型检查、单元测试、playground。

## 2. 第一版限制

### 2.1 Model / DI 第一版限制

- `@UseModel` 必须显式 token：`@UseModel(CounterData)`，不支持裸 `@UseModel counterData`；
- 每个 Model **只能 per-component**，没有 `@Scope('app')` / `inherited` / `@Named`；
- Model 构造函数必须无参；
- Model `@Prop` 是 owner 组件同名 `@Prop` 的只读投影；组件必须声明；
- `pre` Model 不能依赖 `after` Model（阶段冲突报错）；
- 循环依赖直接报错，不做代理；
- Model 不参与 DevTools 数据图展示。

### 2.2 组件 / 运行时第一版限制

- 无插槽（默认/具名/作用域），只有 `props.children`；
- 无组件 emits / `$attrs` / `$slots` / `$emit`；
- 无显式 `defineExpose` / 组件公开 API 边界；
- `@Prop` 无 required / default / validator / 类型运行时告警；
- 异步组件只有 `lazy`，无 loading/error/retry/timeout 组合；
- 无 TransitionGroup / 动态组件辅助 API；
- `nextTick` 在 `@actview/core` 导出，但用户聚合入口 `actview` 未导出；
- 无 app 插件系统（`app.use` / `app.component` / `app.directive` / dev-only config）。

### 2.3 平台 / 工程限制

- 无 SSR / hydrate / `renderToString` / streaming；
- 无 HMR、Vite 开发插件、错误 overlay；
- 无官方测试工具包（当前测试是仓库内部测试）；
- 无路由包（`@actview/router` 尚不存在）；
- 无 CLI / 脚手架 / 文档站 / DevTools UI；
- 仅 DOM 渲染器，没有 `createRenderer` 自定义平台抽象；
- 装饰器为 legacy（`experimentalDecorators`），未迁移 Stage 3；
- `patchComponent` / `patchElement` 仍内聚在 `runtime/patch/index.ts`（`patchProps` 已独立）。

## 3. P0：框架核心 API 完整性

1. **组件插槽**：默认、具名、作用域插槽；类型推导与 children 归一化。
2. **组件事件**：`emits` 声明、`$emit`、父组件监听、事件类型。
3. **`$attrs` / 属性透传**：未声明 props 的属性落到根节点；`inheritAttrs`。
4. **组件 ref / `defineExpose`**：父组件只访问显式公开的 API。
5. **Props 运行时能力**：required / default / validator / 类型告警。
6. **异步组件增强**：loading / error / retry / timeout；与 Suspense/ErrorBoundary 组合。
7. **动态组件与 TransitionGroup**。
8. **公开 API 补齐**：`nextTick` 进入 `actview`；`$attrs` / `$slots` / `$emit` / `$refs` 语义完整；明确内部 API 边界。
9. **App / 插件系统**：`app.use`、`app.component`、`app.directive`、`app.config.errorHandler` / `warnHandler` / `performance`。

## 4. P1：生产可用性

10. **SSR / Hydration**
    - `renderToString`、SSR 构建入口、客户端 hydrate；
    - async setup / Suspense 服务端渲染；
    - 每请求独立 Model scope，避免跨请求状态污染。
11. **HMR 与开发体验**
    - Vite 插件：HMR、组件/Model 状态保留、错误 overlay、source map；
    - 开发警告、生产裁剪、组件栈定位。
12. **路由**
    - 独立 `@actview/router`：嵌套路由、参数、守卫、懒加载、滚动恢复、SSR 集成；
    - 与 KeepAlive / Transition 配合。
13. **官方测试工具**
    - `mount` / `trigger` / `flushPromises` / DOM 断言；
    - SSR、异步组件、ErrorBoundary、KeepAlive 测试基建。
14. **错误恢复**
    - ErrorBoundary 重试/重置；async setup 取消/超时；errorCaptured 完整传播。
15. **DevTools**
    - 组件树、props/state、事件、Model 依赖图、性能时间线、状态编辑。

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

1. **Slots + emits + `$attrs` + `defineExpose` + props 校验**（组件模型闭环）；
2. **App 插件 API + `nextTick` 等公开 API + 官方测试工具**（可被应用和生态使用）；
3. **SSR/hydration 或 HMR/Vite 插件** 二选一先做（部署能力 vs 开发体验）。

路由、DevTools、CLI、生态包可以在独立包中并行推进，不阻塞 core。

## 8. 相关文档

- [architecture.md](./architecture.md) — 包结构 / 公开边界
- [decorators.md](./decorators.md) — 类组件与装饰器
- [dependency-injection.md](./dependency-injection.md) — Model / @UseModel 设计与限制
- [renderer.md](./renderer.md) — 渲染器现状与限制
- [build.md](./build.md) — 构建链
