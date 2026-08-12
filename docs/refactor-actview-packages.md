# ActView 本项目 `packages/` + `plugins/` 重构建议

> 状态：**方案草案（未改动任何代码）**
> 目标：E:\code3\actview 自身 monorepo —— 8 个发布包、两个顶级目录。
> 原则：**不改 npm 发布包名**（`@actview/*` 已发布），只重构目录归属、依赖方向与声明；对外 API 与发布产物零变化。
> 参考：vue3/react 侧同类分析见同目录 `refactor-vue3-packages.md`、`refactor-react-packages.md`。

---

## 一、现状概览

pnpm monorepo（`pnpm-workspace.yaml` 收录 `packages/*` 与 `plugins/*`），8 个发布包：

| 目录 | 包 | 版本 | 定位 |
|------|-----|------|------|
| `packages/` | `actview` | 1.0.25 | 框架聚合入口（re-export `@actview/core` 全部 API） |
| | `@actview/core` | 1.0.26 | 响应式 + DOM 渲染 + 组件运行时（内部 `reactivity/` + `runtime/`） |
| | `@actview/jsx` | 1.0.12 | JSX 工厂 + 全局类型增强（最底层，零依赖） |
| | `@actview/router` | 1.0.11 | 仿 Vue Router 最小版 |
| `plugins/` | `@actview/babel-plugin-actview` | 0.1.3 | 编译核心：纯 Babel 插件（`defineComponent` 转换，无 Vite 概念） |
| | `@actview/plugin-vite` | 1.0.14 | 46 行 Vite 宿主壳，调编译核心 |
| | `@actview/plugin` | 1.0.13 | deprecated 兼容 re-export（`deprecated` 字段已标注） |
| | `@actview/plugin-scoped` | 0.2.2 | scoped CSS：babel.ts（JSX 注入）/ css.ts（PostCSS）/ vite-plugin.ts（组合）三层 |

发布顺序（`scripts/release.mjs` 的 `PACKAGES` 数组）：jsx → core → babel-plugin-actview → plugin-vite → plugin → plugin-scoped → router → actview。

包间依赖：

```
@actview/jsx（零依赖底座）
  ├─ @actview/core ──→（类型契约）@actview/jsx
  │     ├─ actview（聚合 re-export core）
  │     └─ @actview/router ──→ core + jsx
  └─（消费方经 tsconfig jsxImportSource: "@actview/jsx" 使用）

@actview/babel-plugin-actview ──→ @babel/core
  ├─ @actview/plugin-vite ──→ babel-plugin-actview + @babel/core
  └─ @actview/plugin（deprecated）──→ plugin-vite + babel-plugin-actview
@actview/plugin-scoped ──→ @babel/core + postcss + postcss-selector-parser；peer: vite
```

**做得对的部分**（重构时保留）：`packages/`（运行时）vs `plugins/`（工具链）顶级划分语义清晰；编译核心 `babel-plugin-actview` 保持纯 Babel、可脱离 Vite 复用；`plugin-scoped` 三层单向依赖（vite-plugin → css.ts + babel.ts → css.ts）无环；`babel-plugin-actview` 虽为 412 行单文件，但 13 个顶层函数 + 分区注释，结构良好无需强拆。

## 二、核心问题清单

| # | 问题 | 证据 |
|---|------|------|
| 1 | **core 内部依赖方向倒挂**：响应式**引擎** `runtime/reactive-system.ts`（ReactiveEffect/track/trigger/调度队列）放在 `runtime/`，而 `reactivity/` 目录只是薄 API 门面，四个文件全部反向 import 引擎；目录名与依赖方向相反 | `reactivity/ref.ts:2`、`computed.ts:1`、`reactive.ts:1-6`、`watch.ts:1` 均 `import ... from '../runtime/reactive-system'` |
| 2 | **跨目录环**：`runtime/errorBoundary.ts:3`、`runtime/suspense.ts:3` import `reactivity/ref`，而 `reactivity/*` 又依赖 `runtime/reactive-system` → `runtime → reactivity → runtime` | 同上 + `errorBoundary.ts:3`、`suspense.ts:3` |
| 3 | **`renderer ↔ mountComponent` 运行时双向环**：`renderer.ts:7` import mountComponent，`mountComponent.ts:16` 又 import renderer；`transition.ts:10-12` 已用 `bindPatchChildren` 注入模式规避同类问题，renderer/mountComponent 之间未采用 | `renderer.ts:7,143,271`、`mountComponent.ts:16,139` |
| 4 | **`src/types.d.ts` 游离于体系外**：`.d.ts` 后缀 + 非 `type` import（`types.d.ts:1`），与 `reactive-system.ts:1` 的 `import type { Dep } from '../types'` 构成类型级环 | `core/src/types.d.ts` |
| 5 | **core 对 `@actview/jsx` 是纯类型契约依赖**：全包唯一消费点 `renderToString.ts:1` 的 `import type { VNode }`；运行时零耦合（dist 产物无 jsx import），VNode 靠 `Symbol.for('react.element')` 结构契约对接 | `renderToString.ts:1`、`renderer.ts:18-20`、`core/package.json:9` |
| 6 | **【明确缺陷】`plugin-vite` 缺 `vite` peerDependencies**：同为 Vite 插件，`plugin-scoped` 声明了 `vite: "^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0"` + `peerDependenciesMeta.optional:false`，plugin-vite 完全没声明，单独安装会触发 pnpm 严格 peer 校验 | `plugin-vite/package.json:9-12`、`plugin-scoped/package.json:14-21` |
| 7 | **三包把 `@babel/core` 放 `dependencies`**（规范问题，非缺陷）：babel 插件惯例是 peer 声明（宿主与插件共享单实例）；当前自洽，发布后只是多装一份 | `babel-plugin-actview/package.json:9-11`、`plugin-vite/package.json:10-11`、`plugin-scoped/package.json:9-13` |
| 8 | **`plugin-vite`/`plugin-scoped` 缺 `@types/node` devDependencies**：源码直接用 `node:path`/`node:crypto` 且 tsconfig `types:["node"]`，独立 checkout 类型检查会挂 | `css.ts:15`、`vite-plugin.ts:9` |
| 9 | **两份同构的 Babel 宿主壳**：plugin-vite 的 `vite-plugin.ts`（46 行）与 plugin-scoped 的 `jsxPlugin`（`vite-plugin.ts` 内）都是 `enforce:'pre'` + `createConfigItemSync` + `transformSync` + `parserOpts:['jsx','typescript']` + `retainLines`/`sourceMaps`，各写了一份 | `plugin-vite/src/vite-plugin.ts`、`plugin-scoped/src/vite-plugin.ts` |
| 10 | **命名/收尾**：根 `package.json` name 仍是 `"jsx-demo"`；版本体系不统一（`1.x` vs `0.1.x`/`0.2.x`）；`@actview/plugin` deprecated 包仍在 workspace 与发布顺序中；`actview` 聚合包声明 jsx 依赖但入口未 re-export 任何 jsx 符号 | 根 `package.json:2`、各包 version、`release.mjs` |

## 三、目标结构（推荐方案）

### 3.1 `core` 内部重组（本次重构的核心）

**引擎归位**：把响应式引擎从 `runtime/` 移回 `reactivity/`，让目录名与依赖方向一致（`reactivity ← runtime`，对齐 Vue 惯例）。

```
packages/core/src/
  reactivity/            # 响应式域（引擎 + API 门面，最底层）
    reactive-system.ts   #   ← 自 runtime/ 移入（ReactiveEffect/track/trigger/调度队列）
    effectScope.ts       #   ← 自 runtime/ 移入（本就属于响应式域）
    ref.ts               #   （原样）
    reactive.ts          #   （原样）
    computed.ts          #   （原样）
    watch.ts             #   （原样）
    index.ts             #   补导出 reactive-system/effectScope（保持对外 API 不变）
  runtime/               # 渲染与组件运行时（只依赖 reactivity/）
    renderer.ts          #   （原样）
    mountComponent.ts    #   （原样）
    lifecycle.ts         #   （原样）
    component.ts         #   （原样）
    createApp.ts         #   （原样）
    keepAlive.ts         #   （原样）
    errorBoundary.ts     #   （原样）
    suspense.ts          #   （原样）
    transition.ts        #   （原样）
    renderToString.ts    #   （原样）
    index.ts             #   移除 reactive-system/effectScope 的重复导出
  types.ts               #   ← 原 types.d.ts 规范化（见四-3）
```

> 依赖方向修正后：`runtime/errorBoundary、suspense → reactivity/ref → reactivity/reactive-system`，环消失；`runtime/` 内部只剩 renderer ↔ mountComponent 一个环（阶段三处理）。

### 3.2 插件壳去重

在 `babel-plugin-actview` 中新增共享 helper，两个 Vite 宿主包复用：

```
plugins/babel-plugin-actview/src/
  babel-plugin.ts        # 编译核心（不动）
  babel-host.ts          # 新增：createBabelTransform(plugin) —— 封装 ConfigItem 缓存 +
                        #   transformSync + parserOpts + retainLines/sourceMaps + ?t= query 剥离
  index.ts               # 增补导出 createBabelTransform

plugins/plugin-vite/src/vite-plugin.ts    # 改为调用 createBabelTransform(defineComponentPlugin)
plugins/plugin-scoped/src/vite-plugin.ts  # jsxPlugin 改为调用 createBabelTransform(scopedBabelPlugin)
                                          # （cssImportMap 预扫描等组合逻辑留在本包）
```

### 3.3 依赖声明修正

| 包 | 修改 |
|----|------|
| `plugin-vite` | 补 `peerDependencies: { vite: "^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0" }` + `peerDependenciesMeta.vite.optional:false`（与 plugin-scoped 对齐） |
| `plugin-vite`、`plugin-scoped` | 补 `devDependencies: { "@types/node": ... }` |
| 三个 babel 相关包 | `@babel/core` 移入 `peerDependencies`（规范）或保持 `dependencies`（省心）——**二选一，需权衡**，见五-成本 |

### 3.4 收尾

- 根 `package.json` name `"jsx-demo"` → `"actview"`。
- `@actview/plugin` 淘汰路径：模板项目（E:\code3\actview-template）切到 `plugin-vite` → 从 `release.mjs` 的 `PACKAGES` 移除 → 保留 deprecated 包但不进发布循环。
- 版本策略定夺：`babel-plugin-actview`（0.1.x）、`plugin-scoped`（0.2.x）升 `1.x` 统一，或明确"0.x = 新拆分未稳定"并写进 README。
- `actview` 聚合包：若 VNode 类型体系建立（见四-5）则移除 `@actview/jsx` 依赖；否则保留并在 package.json 注释"仅供类型契约"；入口注释补充"不含 router（独立包，对齐 vue-router 模型）"。

## 四、迁移清单

1. **引擎归位**（git mv）：
   - `runtime/reactive-system.ts`、`runtime/effectScope.ts` → `reactivity/`。
   - 修正 core 内部 import 路径：`reactivity/{computed,reactive,ref,watch}.ts` 与 `runtime/mountComponent.ts` 中的 `'../runtime/reactive-system'` → `'../reactivity/reactive-system'`（runtime 内引用 `'./effectScope'` → `'../reactivity/effectScope'`）。
   - `runtime/index.ts` 移除 `export * from './reactive-system'`；`reactivity/index.ts` 补上对应导出（core 对外 `export * from './reactivity'` + `'./runtime'` 不变，**公开 API 稳定**）。
2. **types.d.ts 规范化**：改为 `types.ts`；`types.ts` 内改用 `import type`；消解与 reactive-system 的类型级环。
3. **壳去重**：`babel-plugin-actview` 新增 `babel-host.ts` 并导出；plugin-vite / plugin-scoped 的 vite-plugin.ts 改调 helper；跑插件层测试确认行为不变。
4. **peer 修正**：plugin-vite 补 vite peer；两包补 `@types/node` devDependencies；`@babel/core` 归属决策后执行。
5. **可选：VNode 类型体系**：core 自持 `VNode` 类型定义（与 `@actview/jsx` 的 element 形状结构兼容），`renderToString.ts` 改引用本地类型，runtime 其他 `any` 逐步收敛；届时 `core` 对 `@actview/jsx` 的依赖可降级为 `devDependencies`（d.ts 不再引用它）。
6. **循环消除（阶段三）**：`renderer ↔ mountComponent` 按 `transition.ts` 的 `bindPatchChildren` 注入模式处理，或抽取二者共用的模块。
7. **收尾**：根 name、plugin 淘汰、版本策略、actview 包注释（见三-3.4）。

## 五、收益与成本

**收益**
- core 目录名 = 依赖方向：`reactivity/` 成为真正底层，新人从目录一眼看懂分层。
- 插件包声明规范：peer 对齐后 pnpm 严格校验不再告警；`@types/node` 补齐后独立 checkout 可编译。
- 两份同构 Babel 宿主壳收敛为一处，改 Babel 调用参数只动一个文件。

**成本（需同步修改）**
- core 内部 import 路径批量修改（仅 core 包内，其他包经 `@actview/core` 包名导入，**不受影响**——这是 monorepo 用包名而非相对路径的好处）。
- `release.mjs` / 根 `package.json` scripts 中的包路径假设（若移动目录）。
- **`@babel/core` 移 peer 的权衡**：peer 更规范（共享实例、版本一致）但给最终用户新增"必须自装 @babel/core"的负担；保持 dependencies 更省心。Vite 生态惯例（如 `@vitejs/plugin-vue` 把编译器放 dependencies）偏向省心。**建议默认保持 dependencies，仅当出现版本冲突时再议**。
- git 历史：全程 `git mv` 保留追踪。

## 六、分阶段实施建议

1. **阶段一（core 引擎归位）**：git mv + import 路径修正 + 导出调整。验证：`pnpm test` / `npx tsc --noEmit` / `npx vite build` 三绿，且 `packages/core/dist` 产物 API 无 diff（对外零变化）。
2. **阶段二（插件层）**：plugin-vite 补 vite peer、两包补 `@types/node`、壳去重（babel-host.ts）。验证：`plugin-scoped/test`、`babel-plugin-actview/test` 全绿。
3. **阶段三（低优先级）**：renderer↔mountComponent 循环消除、VNode 类型体系（含 core 去 jsx 依赖）、`@actview/plugin` 淘汰、根 name/版本统一。各自独立 PR。
