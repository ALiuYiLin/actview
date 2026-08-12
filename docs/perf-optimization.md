# ActView 性能优化方案（基于 js-framework-benchmark 跑分）

> 状态：**方案草案（未改动任何代码）**
> 依据：`README.md:96-137` 的本地实测跑分数据（js-framework-benchmark keyed 模式，Chrome + puppeteer，15 次均值）。
> 目标：把更新路径的短板（局部更新 / 选中行高亮 / 交换 / 删除）追平到 Vue 水平；创建类基准与体积/首屏/内存已健康，不折腾。

---

## 一、跑分解读：短板定位

### CPU 基准（total 均值，ms）

| 基准 | actview | vue | svelte | solid | 差距 | 结论 |
|---|---|---|---|---|---|---|
| 创建 1000 行 | 50.9 | 48.4 | 40.6 | 40.2 | +6% | 接近，mount 路径基本健康 |
| 创建 10000 行 | 561.4 | 526.3 | 450.3 | 446.8 | +7% | 接近 |
| 替换 1000 行 | 55.2 | 51.2 | 44.6 | 44.5 | +8% | 接近 |
| **局部更新（每第 10 行）** | **53.5** | **23.9** | 23.0 | 21.5 | **+2.2×** | **最大短板之一** |
| **选中行高亮** | **37.9** | **8.6** | 12.0 | 8.8 | **+4.4×** | **最大短板之一** |
| 交换两行 | 53.3 | 26.5 | 25.4 | 24.0 | +2.0× | 短板 |
| 删除一行 | 35.3 | 23.2 | 20.1 | 19.0 | +1.5× | 短板 |
| 大表追加 1000 行 | 65.1 | 51.4 | 44.5 | 44.2 | +27% | 中等 |
| 清空 10000 行 | 27.0 | 23.5 | 19.2 | 21.3 | +15% | 接近 |

### 内存 / 体积 / 首屏

| 基准 | actview | vue | solid | 结论 |
|---|---|---|---|---|
| run memory（MB） | 4.11 | 4.08 | 2.85 | 持平 vue，可后续瘦 VNode |
| gzip 体积（kB） | 6.5 | 23.3 | 4.5 | 健康 |
| 首屏绘制（ms） | 333.0 | 332.1 | 328.3 | 持平 |

**结论**：瓶颈集中在**更新路径**——每次 update 都是全量重渲染 + 全量 patch，没有任何"跳过静态部分"的手段。

## 二、瓶颈根因（源码实证）

1. **`patchProps` 无条件写 DOM**（`renderer.ts:492-508` + `setProp:557`）：新旧值**无 `Object.is` 比较**，`el.className` / `setAttribute` 每次照写。选中行高亮 = 1000 行 × ~3 属性全量重写 → 37.9ms 的主要来源。
   - 注意：`setInputValue:605` 已做 `el.value === str` 短路，但普通属性路径没有。
2. **`patchChildren` 无引用短路**（`renderer.ts:327-351`）：每次全量 `normalizeChildren + toVNode + keyed diff`，即使子树完全没变。
3. **无编译期静态信息**：Vue 靠 `_hoisted_`（静态提升）+ `PatchFlags`（动态标记）在编译期就知道哪里会变、哪里永远不变；ActView 的 `babel-plugin-actview` 目前只做 `defineComponent` 转换，JSX 静态分析是空白。
4. **事件侧已健康**：`patchEvent:531` 已有 invoker 缓存（`_vei`，handler 更新只换 `value`，对齐 Vue）——事件绑定不是瓶颈。
5. **`patch` 已有同引用短路**（`renderer.ts:97` `oldVnode === newVnode` return）——这是 P1 静态提升能零运行时成本生效的现成机制。

## 三、优化方案

### P0：运行时微优化（~30 行，零编译期，先做）

1. **`patchProps` 值比较短路**：删除循环与设置循环均加 `Object.is(oldProps[key], newProps[key])` 判断，相等跳过 `setProp`。
   - 直接命中：选中行高亮（+4.4×）、局部更新。
2. **`patchVNode` 原生元素分支**：`if (oldVnode.props === newVnode.props)` 整体跳过 patchProps（编译期 hoist 后 props 引用稳定，配合生效）。
3. **`patchChildren` 前置短路**：`oldChildren === newChildren` 直接返回（引用相同 = 子树未重建）。

> 风险：极低（纯增量优化，行为不变）；现有 220 测试用例全覆盖。

### P1：编译期静态标记（对齐 Vue 核心手段，收益最大）

在 `babel-plugin-actview` 增加 JSX 静态分析，`core` renderer 识别标记：

1. **静态提升（hoist，对标 `_hoisted_`）**：JSX 子树无动态表达式（props/children 仅字符串/数字/常量）→ 提升为模块级常量，render 复用同一 VNode 对象。
   - 运行时**零改动**：现有 `oldVnode === newVnode` 引用短路自动跳过整个子树 diff。
2. **动态标记（PatchFlags，对标 Vue patchFlag）**：对含动态绑定的元素，编译期打标：
   - `TEXT`：children 为动态文本 → 运行时只更新 `textContent`，不 diff children（命中"局部更新"：每行仅 label 文本变）
   - `PROPS: [keys]`：只 patch 指定 key（命中"选中行高亮"：仅 class 变）
   - `STABLE`：children 为静态数组 → 复用，不做 keyed diff
   - 运行时 `patchVNode` 按 flag 分支走最小 patch 路径。
3. 落地载体：
   - `plugins/babel-plugin-actview/src/babel-plugin.ts`：JSX 元素遍历（`walkJSX`）中做动态性分析，产出 `_hoisted_` 常量声明与 VNode 上的 `__patchFlag` / `__propsKeys` 标记。
   - `packages/core/src/runtime/renderer.ts`：`patchVNode` / `patchProps` / `patchChildren` 识别标记分支。
   - 类型：`packages/core/src/vnode.ts` 增加 `patchFlag` 字段。

### P2：进阶（后续按需）

1. **`createStaticVNode` 批量块**（对标 Vue）：纯静态大块一次性 `innerHTML` 创建，patch 完全跳过（适合页面框架布局等大段静态结构）。
2. **keyed diff 空转优化**：全复用场景（source 全命中）跳过 LIS 计算（`renderer.ts:464 getSequence`）。
3. **VNode 瘦身**：压缩 VNode 字段（`__avChildren` 等运行时缓存与类型字段分离），降 run memory（4.11MB → 目标 ~3MB，对标 solid 2.85）。
4. **mount 路径**：`createElement` 批量/文档片段、文本节点合并创建（创建类基准再压 5-10%）。

## 四、预估收益

| 基准 | 当前 | P0 后（预计） | P0+P1 后（目标） |
|---|---|---|---|
| 选中行高亮 | 37.9 | ~15 | **~10**（追平 vue） |
| 局部更新 | 53.5 | ~45 | **~25** |
| 交换两行 | 53.3 | ~45 | **~28** |
| 删除一行 | 35.3 | ~30 | **~24** |
| 创建类 | 不变 | 不变 | 基本不变 |

## 五、实施建议

1. **阶段一（P0）**：独立 PR，低风险立即见效。验证：`pnpm test`（220 用例）+ benchmark 复测（`README.md:127-137` 复现步骤）。
2. **阶段二（P1）**：babel 插件静态分析（hoist + flags）→ renderer 按 flag 分支；babel 插件已有 `test/plugin.test.ts` 30 用例可扩展静态分析用例。
3. **阶段三（P2）**：按 benchmark 复测数据决定是否投入（内存/创建类优先级低）。

## 六、复现

```bash
git clone https://github.com/ALiuYiLin/js-framework-benchmark
cd js-framework-benchmark
npm ci && npm run install-local
npm start   # 后台常驻：http://localhost:8080
cd frameworks/keyed/actview && npm ci && npm run build-prod
cd ../.. && node webdriver-ts/dist/benchmarkRunner.js keyed/actview
cd webdriver-ts && npm run results   # 结果表：http://localhost:8080/webdriver-ts-results/dist/index.html
```

## 七、B 方案实测：行组件化（benchmark 实现定制）

> 时间线：P0/P1/P2 已完成（见 `docs/p1-optimization.md`）。本阶段验证"行组件化 + 不可变更新"路径。

### 背景

benchmark 的 update 是**原地改**（`_rows[i].label += '!!!'`），行对象引用不变 → `patchComponent` 的 `isSameProps` 引用比较会误判"未变"（正确性 bug）。B 方案把 benchmark 实现改为：

- **行组件化**：`rows.map(row => <Row key={row.id} row={row} selected={...} onSelect={...} onRemove={...} />)`，`Row` 是 `defineComponent({ props: [...] })`
- **不可变更新**：`rows.splice(0, rows.length, ...rows.map((r,i) => i%10===0 ? {...r, label: r.label+'!!!'} : r))` —— 变化的行创建新对象，未变行返回原引用

依赖 ActView **现成**的 `patchComponent` 短路机制（`renderer.ts:298`），框架零改动。

### 实测结果（count=3，本地同环境，P2 后基线）

| 基准 | P2 基线 | B 方案 | 变化 |
|---|---|---|---|
| 01 创建 1000 行 | 54.9 | 54.9 | 0% |
| 03 局部更新 x16 | 43.0 | **36.3** | **-15.6%** ✅ |
| 04 选中高亮 | 27.4 | **35.5** | **+29.6% 退化** ❌ |
| 05 交换 | 46.6 | **33.9** | **-27.3%** ✅ |
| 06 删除 1 行 | 30.0 | **22.4** | **-25.2%** ✅ |

### 结论

1. **数据行变化的场景全部显著提升**：`isSameProps` 引用短路生效，未变行跳过 update/render/patch。交换/删除同理（其他 998/999 行短路）。
2. **选中高亮退化**：`selected` 作 props 传 1000 行 → select 时全行 props 变 → 全量更新。**这正是 Vue 用 `v-memo` 而非行组件的原因** —— 引用短路无法处理"全局状态"变化。
3. 创建持平：1000 个组件实例的开销与短路机制抵消。

### 与 Vue 对比

| | 局部更新 | 高亮 |
|---|---|---|
| Vue（v-memo） | 23.9 | 8.6 |
| ActView B 方案 | 36.3 | 35.5 |

行组件化只能吃下一半收益（数据行变化）；**高亮需 v-memo 式显式依赖（A 方案）才能追平**。A 方案（`v-memo` 指令：JSX 属性 → babel 编译期提取 deps → 运行时行级缓存）为后续优先方向。

### 备注

- benchmark 实现当前保留 B 方案状态（`frameworks/keyed/actview/src/App.tsx`，未提交到 benchmark 仓库）
- 测试过程：`npm run build-prod` 后 `node webdriver-ts/dist/benchmarkRunner.js --framework keyed/actview --count 3 --benchmark 01_run1k 03_update10th1k_x16 04_select1k 05_swap1k 06_remove-one-1k`

## 八、A 方案实测：v-memo 指令（框架内实现）

> 时间线：B 方案（行组件化）结论已记录于第七章。本阶段在框架内实现 `v-memo` 指令。

### 实现（ActView 框架侧）

- **babel 插件**（`babel-plugin-actview`）：识别 JSX 属性 `v-memo={[...]}` → 编译为 `_jsx` 调用的第 7 参（deps 工厂 `() => [...]`），不进 props、元素不整体 hoist
- **jsxFactory**（`createVNode` 第 7 参 `memoDeps`）：**render 时立即求值**存 `__memoValue` —— 工厂在 render effect 内执行，保证 deps 里的响应式变量（如 `selected`）被追踪（这是早期实现的关键修正：若推迟到 patch 阶段求值，selected 变化不会触发重渲染）
- **renderer**（`patchVNode` 开头）：`sameMemoDeps`（逐项 `Object.is` 值比较）相同 → 继承 `el/__avChildren` 后直接返回，整棵子树短路（不 diff / 不碰 DOM）
- **update 原地改即可**：值比较不要求不可变更新（对比 B 方案的前提）

### benchmark 用法

```tsx
<tr
  key={row.id}
  class={row.id === selected.value ? "danger" : ""}
  v-memo={[row.label, row.id === selected.value]}
>
```

### 实测结果（count=3，本地同环境）

| 基准 | P2 基线 | B 方案 | A 方案 (v-memo) | vs P2 |
|---|---|---|---|---|
| 01 创建 | 54.9 | 54.9 | 55.5 | ≈ |
| 02 替换 | – | – | 57.7 | – |
| 03 局部更新 | 43.0 | 36.3 | **35.2** | **-18.1%** |
| 04 选中高亮 | 27.4 | 35.5（退化） | **18.0** | **-34.3%** |
| 05 交换 | 46.6 | 33.9 | **31.5** | **-32.4%** |
| 06 删除 | 30.0 | 22.4 | 28.0 | -6.7% |

### 结论

1. **v-memo 解决了 B 方案的痛点**：选中高亮 27.4 → 18.0（-34.3%），selected 变化只 patch 受影响行（v-memo 短路），不再全量。
2. **局部更新/交换同样受益**（短路对数据行变化也生效），且 update 可保持原地改（无需 benchmark 定制不可变更新，公平性优于 B）。
3. **仍与 Vue 有差距**（高亮 18.0 vs 8.6，局部更新 35.2 vs 23.9）：v-memo 短路后**选中行自身的 patch 仍是全量子树 diff**（td/文本/事件全比较）——Vue 是 block tree（`dynamicChildren`），patch 时只处理行内动态节点。**剩余差距对应 C 方案（block tree）**。
4. 测试：babel 编译 3 用例 + 运行时 3 用例（MutationObserver 验证未变行零 DOM 变更）全绿，全套 226 测试通过。

### 后续

C 方案（block tree：编译期收集 dynamicChildren，patch 只遍历动态节点）可进一步追平 Vue 的选中行 patch 开销；同时对"大量静态骨架"页面（表单/文档）有独立收益。

## 九、C 方案实测：block tree（v-memo 行 = block，收集 dynamicChildren）

> 时间线：A 方案（v-memo）已落地。本阶段实现 block tree——v-memo 元素作为 block，收集其内部动态节点，patch 时只遍历动态节点（跳过静态骨架树 diff）。

### 实现

- **jsxFactory**：`openBlock()`/`setupBlock()`（栈式）——babel 把 v-memo 元素编译为 `(openBlock(), setupBlock(_jsx(...)))`；动态节点（`patchFlag ≠ 0` 且非 v-memo 根）创建时 push 进当前 block；`setupBlock` 把收集数组挂到元素 `__dynamicChildren`
- **renderer**：`patchElement` 遇 `__dynamicChildren` 只按索引配对 patch 动态节点（跳过静态骨架树 diff）；**v-memo 短路时同步继承 `__dynamicChildren`**（否则短路轮的新动态节点无 `el`，下一轮 patch 崩溃——实现期的关键 bug）
- babel 插件：v-memo 元素 openBlock/setupBlock 包装 + 自动注入 import

### 实测结果（count=3，同环境对比 A 方案）

| 基准 | A (v-memo) | C (v-memo+block) |
|---|---|---|
| 01 创建 | 55.5 | 53.5 |
| 02 替换 | 57.7 | 60.3 |
| 03 局部更新 | 35.2 | 37.1 |
| 04 选中高亮 | 18.0 | 21.5 |
| 05 交换 | 31.5 | 33.8 |
| 06 删除 | 28.0 | 26.4 |

### 结论

1. **数据页（每行都动态）无净收益**：block 收集 push 全量（1000 行 × 2-3 个动态节点/渲染）的 render 开销 ≈ patch 省下的收益，且 stddev 较大（04 高亮 18.3–30.5），差异在噪声内。
2. **block tree 的价值在"静态为主"页面**（表单/文档：大量静态骨架 + 少量动态点——收集便宜、patch 省的多）。benchmark 数据页无法体现。
3. **v-memo 才是数据页的主要收益来源**（高亮 27.4→18.0 来自 v-memo 短路，不是 block）。
4. 实现保留（通用能力，无回归）：测试 232 全绿（jsxFactory 收集 4 用例 + 运行时静态骨架零变更 + babel 编译 2 用例）。

### 三条优化路径最终结论

| 方案 | 机制 | 数据页收益 | 结论 |
|---|---|---|---|
| B 行组件化 | 引用短路（需不可变） | 局部/交换/删除 ↑，高亮 ↓ | 全局状态无法引用短路，弃 |
| A v-memo | 显式 deps 值比较短路 | 全部 ↑（高亮 -34%） | **落地，主收益** |
| C block tree | 收集动态节点，patch 只遍历 | 无净收益（全动态页） | 保留为静态页能力 |
