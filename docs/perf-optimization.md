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
