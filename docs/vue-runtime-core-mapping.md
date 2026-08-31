# Vue runtime-core 对照清单（actview 移植路线图）

> 定位：actview = **Vue 的运行时架构 + React 的 JSX 语法层**。
> 本清单按 Vue 源码包逐模块核对 actview 现状，标注照搬程度与差距，作为长期 roadmap。
> 差距编号引用 `docs/framework-gaps.md`。

## ⚠️ 2026 架构转向（v2）：本清单的 v1 部分已冻结

见 `docs/architecture-v2-vue-base.md`。v2 决策：

- **运行时不再自研/照搬**：直接基于 `vue` 官方包（reactivity / patch / diff /
  内置组件 / SSR 全部复用），v1 的自研 core（本清单 §1-§3 的 ✅ 项）冻结归档。
- **JSX 语法层面对齐 React**：新编译插件 `@actview/plugin-jsx`（fork
  @vue/babel-plugin-jsx）：`className`→`class`、`htmlFor`→`for`、
  `onChange`→`onInput`（text-like）、`dangerouslySetInnerHTML`→`innerHTML`。
- **运行时桥接**：`actview` 包的 defineComponent 用 Proxy 桥接
  `ctx.slots` → `props.children`（React 语义），props 读不到时从 attrs 兜底。
- **createContext**：基于 vue `provide/inject` 封装（React 表面）。
- 本清单 §1-§3 保留作为 v1 实现与 Vue 的对齐记录（研究参考）。

## 0. 照搬边界（总原则）

| 档位 | 含义 | 适用 |
|---|---|---|
| **A 直接照搬** | 纯运行时逻辑，无语法耦合 | 调度器、patch 骨架、reactivity、生命周期时序 |
| **B 适配照搬** | 结构有差异，搬算法、留判定层 | VNode 模型、组件实例、hydration |
| **C 保留自研** | React/JSX 语义，**不照搬** | 编译层、事件命名、props 透传、slots、受控组件、属性映射 |

编译层替代：**SFC 编译器 ≈ Babel 插件**（职责等价：源码 → render 函数）。
语法层保留（用户的既定边界）：JSX、事件命名 `onClick`（React 语义）、受控组件。

---

## 1. @vue/reactivity → `packages/core/src/reactivity/`

| Vue 模块 | actview 对应 | 状态 |
|---|---|---|
| `effect.ts`（ReactiveEffect） | `reactive-system.ts`（id 排序 jobQueue、pre/post flush、checkRecursive） | ✅ A 已照搬 |
| `dep.ts`（targetMap/Dep） | `reactive-system.ts` | ✅ A 已照搬 |
| `reactive.ts` / `baseHandlers.ts` / `collectionHandlers.ts` / `arrayInstrumentations.ts` / `constants.ts` | `reactive.ts`（COMMON/COLLECTION 代理、数组方法增强、Map/Set/Weak 家族） | ✅ A 已照搬 |
| `ref.ts`（ref/shallowRef/toRef/toRefs/triggerRef） | `ref.ts`（另含 unref/toValue/unrefs/rawRef 工厂类型） | ✅ A；缺 **customRef / proxyRefs / toReactive**（P3） |
| `computed.ts` | `computed.ts`（可写、脏检查） | ✅ A；缺 **deferredComputed**（P3） |
| `watch.ts`（flush: pre/post/sync、deep、immediate、once、cleanup） | `watch.ts`（含 onWatcherCleanup，Vue 3.5 风格） | ✅ A 对齐 3.5 |
| `effectScope.ts` | `effectScope.ts`（run/on/off/stop/onScopeDispose/getCurrentScope） | ✅ A |
| `warning.ts` | 无（报错内联 console） | ➖ 不适用 |

## 2. @vue/runtime-core → `packages/core/src/runtime/` + `vnode.ts`

| Vue 模块 | actview 对应 | 状态 |
|---|---|---|
| `vnode.ts`（shapeFlag/位标记） | `vnode.ts`（React 风格：children 数组、key/ref 剥离、`Symbol.for` 类型、**无 shapeFlag**） | 🟡 B 适配：patch 骨架照搬，分支判定层保留 actview 版 |
| `renderer.ts` | `renderer.ts`（patch/patchVNode/patchChildren/patchKeyedChildren/getNextHostNode/sameIndexAnchor/组件更新锚点/lazy 占位/Fragment 位置/unmount childNodes 兜底） | ✅ A（P-A/B/C 已落地） |
| `scheduler.ts` | `reactivity/reactive-system.ts` | ✅ A 已照搬 |
| `component.ts` + `componentPublicInstance.ts` + `componentRenderContext.ts` + `componentRenderUtils.ts` | `mountComponent.ts` + `component.ts`（setup 闭包 render、实例上下文 prev-restore 栈、injects 继承） | 🟡 B：**砍掉 instance.proxy / renderContext**（actview 的 render 是闭包，无 `with(this)` 需求） |
| `componentProps.ts` | `@actview/jsx` MaybeRef 解包 + `useProps.ts`（useProp/useProps） | 🟢 C 保留自研（React 语义） |
| `componentEmits.ts` | 无（`props.onClick` 直传） | 🟢 C 保留自研 |
| `componentSlots.ts` | jsx children / render props | 🟢 C 保留自研 |
| `apiLifecycle.ts` | `lifecycle.ts`（onBeforeMount/Mounted/Updated/BeforeUnmount/Unmounted/Activated/Deactivated/ErrorCaptured/ServerPrefetch/RenderTracked/Triggered + useId/useRootElement） | ✅ A 已照搬 |
| `apiInject.ts` | `context.tsx`（createContext/Provider/useContext，React 语义） | 🟢 C 保留自研 |
| `apiCreateApp.ts` | `createApp.ts`（App 接口 + createApp） | ✅ A |
| `apiDefineComponent.ts` | `component.ts` defineComponent + `plugins/babel`（PascalCase 简写函数自动转换） | ✅ 编译层替代 |
| `apiWatch.ts` / `apiComputed.ts` | `reactivity/watch.ts` / `reactivity/computed.ts` | ✅ A |
| `apiSetupHelpers.ts` | `lifecycle.ts`（getCurrentInstance/setCurrentInstance）+ useProps | ✅ A |
| `apiAsyncComponent.ts` | `suspense.ts`（lazy/defineAsyncComponent 等价） | ✅ A |
| `hydration.ts` | `hydrate.ts`（hydrate/hydrateRoot、P1 场景 8/11） | 🟡 B；剩 **mismatch 逐属性检测**（P3） |
| `errorHandling.ts` | `errorBoundary.ts`（ErrorBoundary 组件 + onErrorCaptured + push/pop 栈） | 🟡 B（Vue 是 callWithErrorHandling 机制，actview 组件化边界） |
| `keepAlive.ts` | `keepAlive.ts`（KeepAlive 内置组件） | ✅ A |
| `transition`（renderer 内 TransitionImpl） | `transition.ts`（CSS 类 + JS 钩子 onBeforeEnter/onEnter/onAfterEnter/onLeave + **TransitionGroup** 列表过渡；9 用例） | ✅ A（P2-2 剩余见 gaps） |
| `teleport`（renderer 内 TeleportImpl） | `transition.ts` 导出 Teleport（与 Transition 共置）+ renderer 分支（target 解析、anchor 跳过 #9071/#9313） | ✅ A |
| `directives.ts` | 无 | ➖ 不适用（React 语义无指令） |
| `h.ts` | `@actview/jsx`（createElement/jsx/jsxs） | ✅ |
| `rendererTemplateRef.ts` | 模板 ref（ref 对象透传，8 用例） | ✅ A |
| v-memo | renderer 内（v-memo 测试 3 用例） | ✅ A |
| `devtools.ts` | `core/devtools.ts` + `packages/devtools` | ✅ |
| `hmr.ts` / `customFormatter.ts` / `profiling.ts` / `featureFlags.ts` | 无 | ➖ 不适用（HMR 归插件层） |

## 3. @vue/runtime-dom → `packages/core/src/runtime/attr-*` + renderer 内联

| Vue 模块 | actview 对应 | 状态 |
|---|---|---|
| `nodeOps.ts` | renderer 内联 DOM 操作（无独立 nodeOps 层） | 🟡 B（已够用；如需平台抽象可后补） |
| `patchProp.ts` | `attr-utils.ts`（unitless 白名单照 React isUnitlessNumber、normalizeClass/Style、resolveAttr 分组 switch：boolean/enumerated/overloaded/numeric/url/namespace、sanitizeURL 照 React、xlink/xml setAttributeNS）+ `attr-map.ts`（HTML_ATTR_OVERRIDES） | 🟢 C 保留自研（React 语义） |
| `jsx.ts`（类型） | `@actview/jsx` types（ClassValue 等） | ✅ |
| `apiCustomElement.ts` | 无 | ➖ 不适用（defineCustomElement 未计划） |

## 4. compiler（SFC → Babel 插件，职责等价）

| Vue 模块 | actview 对应 | 状态 |
|---|---|---|
| `compiler-core`（parse/transform/codegen） | `plugins/babel`（JSX → defineComponent 转换；babel-host 硬排除 node_modules） | ✅ 替代完成 |
| `compiler-sfc`（scoped CSS） | `plugins/scoped`（`?scoped` 导入 + postcss 选择器隔离） | ✅ 替代完成 |
| `runtimeHelpers` | `@actview/jsx`（jsx-runtime / jsx-dev-runtime） | ✅ |
| `compiler-dom` | `plugins/vite`（.tsx/.js 过 Babel，enforce: 'pre'） | ✅ 替代完成 |

## 5. @vue/shared

无独立包：工具函数内联在各模块（attr-utils 等）。可选：抽 `@actview/shared` 共享层（非必须，P3 之后再说）。

## 6. actview 独有扩展（Vue 无对应）

| 模块 | 说明 |
|---|---|
| `runtime/solid.ts` | Solid 风格派生：createEffect/mapArray/createSolidVNode/solidGet |
| `runtime/scopedProps.ts` | scoped CSS 运行时属性注入（编译期由 plugin-scoped 打标） |
| `runtime/context.tsx` | React createContext 语义（Vue 是 provide/inject，actview 两者都有：context.tsx 供 JSX 生态） |
| `runtime/useProps.ts` | useProp/useProps（React 生态习惯的 props 派生 API） |
| `@actview/hooks-react` / `@actview/router` / `@actview/store` / `@actview/testing` / `@actview/devtools` | 生态包，全部 peer `@actview/core`（^1.0.0 宽范围，根治双实例） |

## 7. 待办差距（详见 docs/framework-gaps.md）

| 编号 | 内容 | 对应 Vue |
|---|---|---|
| P2-1 | 流式 SSR（pipeToNodeWritable） | `@vue/server-renderer`（最大项） |
| P2-2 | 动画剩余项（transition 基础/JS 钩子/TransitionGroup 已实现，剩余以 gaps 记录为准） | runtime-core transition |
| P3 | customRef / proxyRefs / toReactive / deferredComputed | @vue/reactivity |
| P3 | 事件委托 | runtime-dom patchProp |
| P3 | 重复 key 告警 | runtime-core renderer |
| P3 | hydration mismatch 逐属性检测 | runtime-core hydration |
| 7.2 | 受控表单剩余：submit/reset、type=number、radio 组 |（React 语义自研项，已记录待排期） |

## 8. 照搬防坑清单（写码前必读）

1. **VNode 判定层保留 actview 版**：无 shapeFlag，patch 分支用 `typeof vnode.type` / `Symbol.for` 判定——照搬 renderer 算法时不要连判定方式一起搬。
2. **不照搬 instance.proxy / renderContext**：actview 的 render 是 setup 闭包，组件更新直接重跑 render 函数。
3. **不照搬 componentProps 的 Boolean/cast/emit 声明**：JSX props 直传 + MaybeRef 解包。
4. **事件语义**：`props.onXxx` 直传，无 emit 声明表。
5. **peer 约定**：所有运行时包 peer `@actview/core: ^1.0.0`；core 破坏性变更必须发 2.0。
