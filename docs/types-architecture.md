# ActView 类型分层：公开类型与内部类型

> 本文档定义重构后 `@actview/runtime-core` / `@actview/jsx` / `@actview/core` 的类型边界。
> 目标：**用户与公开 API 只看到稳定的作者层类型；渲染器内部类型（VNode、组件对象、实例）不出现在公开入口**，两层通过入口（package exports）而不是命名约定分隔。

---

## 1. 分层总览

```
用户 TSX / 公开 API                     渲染器 / compiler 内部
──────────────────────────             ──────────────────────────
JSX.Element  (公开 Element)     ←──    VNode  extends Element
ComponentFunction<P>            ←──    Component<P>  (setup 函数 + __actview_component 标记)
ComponentTag<P>  (JSX 标签视图)         ComponentInternalInstance
string | symbol (标签/Fragment)
```

| 包 | 职责 | 入口 | 包含 |
|---|---|---|---|
| `@actview/runtime-core` | 平台无关的类型基础 + 最小元素工厂 | `.`（公开）/ `./internal`（内部） | 公开：`Element` / `ElementType` / `ComponentFunction` / `ComponentTag` / `ComponentProps` / `ElementChild(ren)` / `RenderFunction` / `SetupContext` / `defineComponent` / `isComponent`；内部：`VNode` / `VNodeTypes` / `VNodeChild(ren)` / `createVNode` / `isVNode` / `Component` / `ComponentInternalInstance` / `SetupFunction` |
| `@actview/compiler` | 编译层 L1：组件函数 → `defineComponent(setup)`（JSX 降级交给宿主 automatic runtime） | `.` / `./vite` | `wrapComponentsPlugin` / `compileComponents()` / `actviewCompiler()`（Vite 宿主）；分层契约见 `docs/compiler-layers.md` |
| `@actview/jsx` | JSX 作者层：用户写 TSX 看到的那一层 | `.` / `./jsx-runtime` / `./jsx-dev-runtime` | 全局 `JSX` 命名空间、DOM/SVG 属性类型、JSX runtime（`jsx` / `jsxs` / `jsxDEV` / `Fragment`），再导出 runtime-core 公开类型 |
| `@actview/core` | DOM 运行时公开层（渲染器，M1/M2/M3 已落地） | `.` | 已实现：`createApp` / `mount` / `unmount`、组件级 re-render（render effect + scheduler）、`patch`（text / element / Fragment / 组件 + LIS keyed diff）、provide/inject、public instance proxy（`$props/$el/$parent/$root/$forceUpdate/$nextTick`）、完整 `patchProp`（DOM property / SVG / 事件选项）、错误处理（ErrorBoundary / onErrorCaptured / errorHandler）、async setup + Suspense + lazy、Teleport / Transition / KeepAlive、DevTools 钩子、生命周期（含 onActivated/onDeactivated）；后续：SSR/hydrate、平台抽象。设计见 `docs/renderer-design.md` |
| `@actview/reactivity` / `@actview/shared` | 响应式 / 内部工具 | — | 与本分层无耦合 |

依赖方向：

```
@actview/jsx ──→ @actview/runtime-core
@actview/core ──→ @actview/runtime-core / @actview/reactivity
@actview/compiler ──→ (无 runtime 依赖；编译产物 import @actview/runtime-core / @actview/jsx)
@actview/runtime-core ──→ (无平台依赖；不 import @actview/jsx / @actview/core)
```

---

## 2. 公开契约

### 2.1 `Element`：4 个稳定字段

```ts
interface Element {
  readonly type: ElementType
  readonly key: string | number | null
  readonly props: Record<string, any> | null
  readonly ref: unknown
}
```

只承诺公开组件需要读取的字段。以下**不属于**公开契约：

- `__v_isVNode`（VNode 品牌）
- `el`（挂载后的宿主节点）
- `component`（组件实例）
- `children` 缓存、`__memoValue` 等渲染器状态

为什么不是完全空（opaque）类型：

- headless / render-prop 模式需要读取 `type` / `key` / `props`（等价 `cloneElement`，见 `docs/headless-components.md`）；
- 完全 opaque 需要额外提供 `getElementType()` / `cloneElement()` 等公开 API，属于后续增量；
- 渲染器仍可把 `Element` 作为边界上的最小承诺：内部 `VNode extends Element`，跨层无需强转。

### 2.2 `ElementType`

```ts
type ElementType = string | symbol | ComponentFunction<any> | ComponentTag<any>
```

- `string`：原生标签（`<div>`）；
- `symbol`：Fragment（`<></>` / `<Fragment>`）；
- `ComponentFunction`：用户源码里的组件函数；
- `ComponentTag`：编译产物（`defineComponent` 返回的带标记 setup 函数）的 JSX 标签视图。

### 2.3 组件两视图：`ComponentFunction` / `ComponentTag`

```ts
// 源码层（用户书写的组件，compiler 转换之前）
type ComponentFunction<P> = (props: P) => Element | null

// 编译产物：setup 函数本体 + 标记（不再包 { __setup } 对象）
type Component<P> = SetupFunction<P> & {
  readonly __actview_component: true
  readonly name?: string
}
// 公开层只给「JSX 标签视图」：调用签名仅用于通过 TS 的 JSX 检查
type ComponentTag<P> = Component<P> & ((props: P) => any)
```

- 运行值是**函数本体**：`defineComponent(setup, name?)` 用 `Object.defineProperty` 在 setup 上写 `__actview_component: true`（可选写 `name`）后原样返回，不再创建 `{ __setup }` 包装对象；
- 渲染层判定组件用 `isComponent(value)`（`typeof value === 'function' && value.__actview_component === true`），然后直接调用该函数得到 render；
- `ComponentTag`（公开）在 `Component` 上叠加 `(props: P) => any` 调用签名：TS 要求 JSX 标签可调用（实测非可调用对象报 TS2604）；该签名只是类型视图，运行时没有这层包装；
- `ComponentProps<C>` 同时支持两种视图（标记函数优先，其次源码函数；`...rest` 吸收 `SetupContext` 参数）。

### 2.4 返回值检查

`ComponentFunction` 的返回类型是 `Element | null`，因此：

```tsx
function NotComponent() { return 1 }   // (props) => number
const x = <NotComponent />             // ✗ 类型期报错（不是 Element）
```

这补上了旧实现"`return 1` 既不被 compiler 包装、类型也不拦，运行时才炸"的漏洞。

---

## 3. JSX 作者层（`@actview/jsx`）

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@actview/jsx"
  }
}
```

`@actview/jsx` 提供：

| 入口 | 内容 |
|---|---|
| `@actview/jsx` | 副作用加载全局 `JSX` 命名空间；再导出 runtime-core 公开类型；导出 `createElement` / `isValidElement` / `Fragment` / JSX runtime |
| `@actview/jsx/jsx-runtime` | JSX automatic runtime（`jsx` / `jsxs` / `jsxDEV` / `Fragment`），编译产物入口 |
| `@actview/jsx/jsx-dev-runtime` | development runtime（额外参数被忽略） |

全局 `JSX` 命名空间（`src/jsx.ts`）：

- `JSX.Element` → `@actview/runtime-core` 的公开 `Element`；
- `JSX.ElementType` → 公开 `ElementType`；
- `JSX.IntrinsicElements` → 各标签属性（`src/jsx/attrs.ts`，从旧 `@actview/jsx` 移植并去掉 VNode 依赖）；
- `JSX.LibraryManagedAttributes` → 组件 props 的 Ref 形态（`MaybeRefProps`）+ HTML 通用属性放行（`class` / `style` / `id` / 事件 / `data-*` / `aria-*` 等），未声明属性报错；
- `JSX.ElementChildrenAttribute` → children 不参与严格检查。

JSX runtime 只依赖公开 `createElement`（返回 `Element`），不接触 `VNode` 类型；`key` 从 props 提升为元素 key。

> 运行时内部对象仍是 `VNode`（`createVNode` 产物，`VNode extends Element`），但该事实不进入公开类型——渲染器在内部入口消费它。

---

## 4. 内部入口约定（`@actview/runtime-core/internal`）

- 只供 workspace 内包（渲染器 / compiler / 测试）使用；
- 不写入 `publishConfig.exports`，发布产物不暴露该子路径；
- 内部模块可以 import 公开契约（`Element` 等），公开入口**不得** import 内部类型；
- 渲染器对 `VNode` 的品牌判定使用 `__v_isVNode`（`isVNode`），不再依赖 React 的 `$$typeof`（如需 React 元素兼容测试工具，后续在 internal 侧加标记，不改变公开契约）。

---

## 5. 不变量（type-tests 守护）

`packages/runtime-core/type-tests/types.test-d.ts`：

1. `VNode` 可赋给 `Element`（`VNode extends Element`）；
2. 公开入口不导出 `VNode`（`import('../src/index').VNode` 报错）；
3. `Element` 无 `__v_isVNode` / `el` / `component` 字段；
4. `ComponentTag` 可作 `ElementType`，`ComponentProps` 可推导 props；
5. `Component` 是带 `__actview_component` 标记的 setup 函数；`isComponent` 只认函数标记（对象不算）；公开入口不导出 `Component` 类型；
6. `createElement` 返回 `Element`；`createVNode` 返回 `VNode`。

`packages/jsx/type-tests/jsx.test-d.tsx`：

1. TSX 组件 props 推导 / 必填 / 未知属性拦截；
2. `JSX.Element` 无 VNode 内部字段；
3. 返回非元素的函数不能当组件；
4. 原生元素属性（`input type` 枚举）与事件参数（`MouseEvent`）检查；
5. `ComponentTag` / `ComponentProps` 公开视图可用。

---

## 6. 验证命令

TypeScript **project references**：根 `tsconfig.json` 编排各 composite 库包（声明产物输出到 `packages/<pkg>/dist-types`，已 gitignore），各包 `tsconfig.test.json`（noEmit）负责 type-tests / 单测类型检查。

```bash
# 全量类型（根 app + 全部库包 + type-tests）
pnpm typecheck
# 等价底层命令：tsc -b tsconfig.json（可二次运行验证 up-to-date）

# 单包类型（构建 + test 配置）
pnpm -C packages/runtime-core typecheck
pnpm -C packages/jsx typecheck
pnpm -C packages/compiler typecheck
pnpm -C packages/core typecheck

# 构建（esm + d.ts；tsup dts 已适配 composite：composite:false）
pnpm build:packages
pnpm build   # tsc -b tsconfig.json && vite build

# 回归（reactivity + runtime-core + core + compiler）
pnpm test
```

> 历史技术债已解决：根配置不再直接按 ES2023 + `erasableSyntaxOnly` 检查 reactivity 源码——`tsc -b` 通过 project reference redirect 使用各包声明产物（reactivity 的 ES2016/enum 特例只在其自身 composite 配置里生效）。
> 应用入口的 `createApp(App)` 现在可由 **`ComponentFunction` 视图**通过类型检查（`createApp` 参数类型为 `ComponentTag | ComponentFunction`，运行时仍用 `isComponent` 严格校验）；发布库若要暴露"编译后对象类型"仍需 compiler 声明改写，见 §7。

---

## 7. 已知边界与后续路线

| 项 | 状态 |
|---|---|
| JSX runtime 的 Ref 顶层解包（`MaybeRef` 属性形态） | 类型已就绪，运行时解包待 JSX runtime 下一步实现 |
| `defineComponent` 实现 | 已实现（`runtime-core/src/component.ts`）：在 setup 函数上写 `__actview_component` 标记并原样返回，返回类型 `ComponentTag<P>`；渲染层用 `isComponent` 判定 |
| DOM renderer（`createApp` / `patch`） | 已实现 M1–M3（`@actview/core`）：createApp/mount/unmount、组件级 re-render、patch（LIS keyed diff）、provide/inject、public instance proxy、完整 patchProp、错误处理、Suspense/lazy、Teleport/Transition/KeepAlive、DevTools；详见 `docs/renderer-design.md` |
| compiler（TSX → `defineComponent`） | 已实现（`@actview/compiler`）：L1 `wrap.ts` + Vite 宿主；JSX 降级交给宿主 automatic runtime（esbuild/tsc），见 `docs/compiler-layers.md` |
| 编译产物的 `.d.ts` 视角 | tsc 只看到源码（函数视角）；`createApp` 已放宽为 `ComponentTag \| ComponentFunction` 让应用入口可检查。发布库若要暴露"编译后对象类型"，需要 compiler 附带声明改写（或显式 `defineComponent`），属后续阶段 |
| 根 `tsconfig` / 构建脚本 | ✅ 已用 project references 解决（`dist-types` 声明产物 + 各包 `tsconfig.test.json`；根 `build` = `tsc -b && vite build`） |
| React 元素兼容标记（`$$typeof`） | 公开层不暴露；是否需要内部兼容层待定 |

---

## 8. 决策记录

1. **公开类型不包含 VNode**：VNode 的渲染器字段（`el`/`component`）会被运行时改写，属实现细节；公开会形成 semver 承诺并允许用户伪造元素。
2. **保留公开 `Element` 的 4 个字段**而不是完全 opaque：headless render-prop（`render={<span/>}` 后读 `type`/`props`）依赖它；完全 opaque 需要另建 `getElementType` / `cloneElement` 公开 API。
3. **`ComponentTag` 保留调用签名**：TS 的 JSX 标签检查要求 call signature（实测非可调用对象报 TS2604），去掉会让所有内置组件无法以 `<KeepAlive/>` 使用；因此把"可调用"限制在公开标签视图，并在内部 `Component` 上去掉调用签名。
4. **内部类型走 `/internal` 子路径**：比"同一入口导出全部、靠文档自律"可检查（type-tests 反向断言），且发布产物可只带公开入口。
5. **JSX 作者层单独成包（`@actview/jsx`）**：`jsxImportSource` 需要一个稳定的运行时/类型入口；DOM 渲染器（`@actview/core`）与作者层解耦，避免渲染器迭代影响编辑器类型体验。
6. **旧 `@actview/jsx` 的 DOM 属性表整体迁移**：类型资产保留、VNode 依赖删除，避免重写回归。
7. **组件 = 带标记的 setup 函数（不再包 `{ __setup }` 对象）**：`defineComponent(setup, name?)` 在函数本体上写 `__actview_component: true` 并原样返回；渲染层用 `isComponent` 判定。少一层对象、少一次字段读取，调用栈/DevTools 里也是原始函数；`ComponentTag` 的调用签名仍只作 TS 的 JSX 标签视图。
