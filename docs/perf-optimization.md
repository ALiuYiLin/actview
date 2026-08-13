# ActView 性能优化记录

> 本文档记录 ActView 的性能优化历程与规划。**已实施部分**（P0 运行时短路 + v-memo 指令）是当前框架代码的真实状态；规划部分（`<solid>` 双模细粒度，一期含集合更新）为下一步方向。
>
> 历史实验（P1 编译期 PatchFlags/hoist、P2 children 分离、C block tree、B 行组件化）均已存档于 git 历史，不在本文档赘述——它们的结论已沉淀进下文"路线决策"。

## 一、已实施：P0 运行时短路

框架代码当前基线。三处短路，全部在 `packages/core/src/runtime/renderer.ts`：

### 1. `patchProps`：新旧值比较，相等跳过

```ts
// 设置/更新新 props：值未变（Object.is）直接跳过，避免无条件写 DOM
for (const key in newProps) {
  if (key === 'children' || key === 'ref') continue
  if (Object.is(oldProps[key], newProps[key])) continue
  setProp(el, key, newProps[key])
}
```

选中行高亮等场景：1000 行 props 每次重渲染都相同，只重写真正变化的行。

### 2. `patchVNode` 原生元素分支：props 引用相同整体跳过

```ts
if (flag === undefined) {
  if (oldVnode.props !== newVnode.props) {
    patchProps(oldVnode.props, newVnode.props, el)
  }
}
```

未编译（手写 `_jsx` / esbuild 产物）路径的引用短路。

### 3. `patchChildren`：children 引用相同跳过整个 diff

配合 VNode 级缓存（`__avChildren`）与引用稳定的子树复用。

**P0 效果**：为后续 v-memo 提供了"引用/值短路"的运行时基础。

## 二、已实施：v-memo 指令（行级显式依赖短路）

### 用法

```tsx
<tr
  key={row.id}
  class={row.id === selected.value ? 'danger' : ''}
  v-memo={[row.label, row.id === selected.value]}
>
```

`v-memo` 接受 deps 数组，**逐项 `Object.is` 值比较**（不要求不可变更新，update 原地改即可）。

### 实现（约 30 行，babel 零改动）

JSX 由 esbuild automatic 转换（`v-memo` 成为 props 键，render 时已求值 → 响应式追踪 ✓）：

1. **jsxFactory**（`packages/jsx/src/jsxFactory.ts`）：从 props 提取 `v-memo` 键 → `vnode.__memoDeps` / `vnode.__memoValue`，从 props 中 `delete`（不进 props、不透传）：

```ts
let memoValue: any
if (props && props['v-memo'] !== undefined) {
  memoValue = props['v-memo']
  delete props['v-memo']
}
const vnode = createVNode(type, key, props)
if (memoValue !== undefined) {
  vnode.__memoDeps = () => memoValue
  vnode.__memoValue = memoValue
}
```

2. **renderer**（`patchVNode` 开头）：deps 与上次相同 → 整棵子树短路（不 diff / 不碰 DOM），DOM 归属（`el`/`__avChildren`）从旧 vnode 继承：

```ts
if (newVnode.__memoDeps) {
  if (oldVnode && oldVnode.__memoValue !== undefined &&
      sameMemoDeps(newVnode.__memoValue, oldVnode.__memoValue)) {
    newVnode.el = oldVnode.el
    newVnode.__avChildren = oldVnode.__avChildren
    return
  }
}
```

`sameMemoDeps`：长度一致 + 逐项 `Object.is`（值比较，非引用比较）。

### 关键设计点

- **deps 必须 render 时求值**（不是 patch 时）：`__memoValue` 在 jsxFactory 里求值，工厂在 render effect 内执行 → deps 里的响应式变量（如 `selected`）被正确追踪，变化才能触发重渲染。
- **短路必须继承 `el`/`__avChildren`**：否则下轮该行不短路时（deps 变了）旧 vnode 失去 DOM 归属。
- **`v-memo` 不进 props**：不透传到 DOM/组件。

## 三、当前 benchmark 数据（本地实测 count=3）

完整数据见 `README.md`。三个阶段对比（单位 ms，本地 Chrome + puppeteer）：

| 基准 | 优化前 | P0+v-memo | `<solid>` 细粒度 | 总变化 |
|---|---|---|---|---|
| 创建 1000 行 | 50.9 | 50.9 | **46.9** | -7.9% |
| 替换 1000 行 | 55.2 | 55.2 | **50.7** | -8.2% |
| 局部更新（每第 10 行） | 53.5 | 33.0 | **27.2** | -49% |
| 选中行高亮 | 37.9 | 20.8 | **10.5** | -72%（接近 Vue 8.6） |
| 交换两行 | 53.3 | 32.7 | **29.7** | -44% |
| 删除一行 | 35.3 | 25.1 | **23.6** | -33% |

创建类基准小幅提升；高亮从 20.8 → 10.5（细粒度直连 DOM，追平 Vue）。

## 四、路线决策（历史实验结论）

| 方案 | 机制 | 结论 |
|---|---|---|
| P1 编译期 PatchFlags/hoist/children 分离 | 让 diff 更轻 | 有额外收益（高亮 22.8→18.0），已存档 |
| B 行组件化 | 引用短路（需不可变） | 全局状态（selected）无法引用短路 → 高亮退化，弃 |
| C block tree | 收集动态节点，patch 只遍历 | 数据页无净收益（收集开销≈patch 收益），保留为静态页能力参考 |

**核心结论**：v-memo 是数据页优化的主收益来源（跨行短路），与 P1/P2 无关；剩余差距在"选中行内部仍是子树 diff"——即细粒度直连。

## 五、已实施：`<solid>` 双模细粒度（一期，含集合更新）

### 目标

消灭"选中行内部子树 diff"：`<solid>` 作用域内的 JSX 编译为 solid 式细粒度——DOM 骨架创建一次，每个 `{expr}` 成为独立 effect 直连 DOM。作用域外保持 Vue 式 re-render + v-memo。**只对热点区域付出细粒度成本**（内存可控）。

### 编译链（两阶段，职责分离）

1. **主插件（defineComponentPlugin）只序列化**：`<solid>` 块内 JSX 用 `@babel/generator` 序列化为源码字符串，产出占位 `_jsx("solid", { children: ["..."] })`（块内 JSX 不再走普通 JSX 编译）。
2. **独立 solid-plugin 二次编译**：Program exit 遍历识别占位，`parseSync` 重新解析字符串 → 编译为 `solidGet(_holder, container => { ... })`：
   - JSX 元素 → `document.createElement` + 静态属性 `setAttribute`（连字符安全）+ `on*` → `addEventListener`（绑定一次，闭包捕获）
   - 动态 `{expr}` → `createEffect(() => node.property = expr)`（直连 DOM）
   - 数组 `arr.map(arrow)` → `mapArray(() => arr, container, arrow)`（项级 keyed 复用）
   - `solidGet` 缓存工厂：holder 挂在组件 setup 级，render 重跑不重建块。

### 集合更新：mapArray 项级 keyed 复用

对齐 solid `reactive/array.ts`，项级 diff：

- 公共前缀/后缀跳过（常见 update/select/remove 零成本）
- Map 索引复用中间项；消失项 `scope.stop()` + 移除 DOM
- **顺序未变 → 零移动**（`childNodes` 顺序检查，覆盖 update/select/remove/append）
- **乱序 → LIS 最小移动**（对齐 Vue `patchKeyedChildren` 的 `getSequence`；新增项统一由移动循环挂载，`isConnected` 判断）
- 删除分支需跳过"被复用到新位置的旧项"（`reusedIdx` 集合）；清空（`newLen === 0`）需同步移除 DOM

### 已修复的坑

- `aria-hidden` 等连字符属性：属性赋值改 `setAttribute`（`t.identifier` 非法）
- babel 8 函数式插件实例缓存 → `solidUsed` 等状态在 Program enter 重置
- 跨行字符串转义（python 脚本写入 `\n` 变真实换行 → 插件语法错误 → 页面白屏）
- mapArray 全量 `appendChild` 重排导致 swap/remove 严重退化 → 顺序检查 + LIS

### 实测（count=3）

高亮 20.8 → **10.5**（追平 Vue 8.6）；局部更新 33.0 → **27.2**；全项提升（见第三章）。

### 后续（二期候选）

- 高亮再压：块内 createSelector 等价物（`id → boolean` 缓存，selected 变化只通知翻转行）
- 行内动态 `class` 的 classList 细分（当前 setAttribute 整体重设）

## 六、复现

```bash
# benchmark 在本地 E:\code3\js-framework-benchmark（frameworks/keyed/actview）
cd frameworks/keyed/actview && npm run build-prod
cd ../.. && npm start   # 后台常驻 http://localhost:8080
cd webdriver-ts && node dist/benchmarkRunner.js --framework keyed/actview --count 5 --benchmark 01_run1k 02_replace1k 03_update10th1k_x16 04_select1k 05_swap1k 06_remove-one-1k 07_create10k 08_create1k-after1k_x2 09_clear1k_x8 21_ready-memory 22_run-memory 25_run-clear-memory 41_size-uncompressed 42_size-compressed
```
