# ActView P1 优化实录（编译期静态标记）

> 状态：**已完成并提交（commit `32564da`）**
> 目标：对齐 Vue 的 `_hoisted_`（静态提升）+ `PatchFlags`（动态标记）思路，让 patch 跳过静态部分。
> 结果：数据页 benchmark 未提升（略差 ~8-12%，原因见 §5）；正确性与架构价值成立（220 测试全绿，修复 6 个潜在 bug）。

---

## 一、设计目标

benchmark 数据页的更新路径（局部更新 / 选中高亮）慢在**每次 update 全量 render + 全量 patch**。P1 的目标是给编译期信息：让运行时知道"哪里会变、哪里永远不变"。

两个机制（对标 Vue）：

| 机制 | Vue | ActView |
|---|---|---|
| 静态提升 | `_hoisted_1 = createElementVNode(...)` | `_hoisted1 = _jsx("span", {...}, undefined, 0)`（模块级常量） |
| 动态标记 | `patchFlag: TEXT / PROPS / STABLE` | `__patchFlag`（1=TEXT、2=PROPS）+ `__propsKeys` |

## 二、实现方式

### 1. babel 插件：完整 JSX 编译（`babel-plugin.ts` +318 行）

源码 JSX 不再交给 esbuild 转 `_jsx`，而是由 `defineComponentPlugin` 自己编译（`compileJsxElement` / `compileJsxFragment` / `buildJsxCall`）：

```jsx
<td class="col-md-1">{row.id}</td>
// ↓ 编译为
_jsx("td", { class: "col-md-1", children: row.id }, undefined, 1 /* PATCH_TEXT */)
```

- **注入 import**：`import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "@actview/jsx/jsx-runtime"`
- **key 提取**：`key` 作为第 3 参（与 esbuild automatic 一致）；无 key 时**显式补 `undefined` 占位**（否则 flag 会错位到第 3 参）
- **空白对齐**：JSXText 按 esbuild/React 规则处理（`^\n\s*` 去头、`\s*\n\s*$` 去尾、内部 `\s*\n\s*` 折叠为单空格、单行文本保留原样）+ HTML 实体解码（`&amp;` → `&`）
- **`{/* 注释 */}`**（JSXEmptyExpression）不产生 children

**hoist（静态提升）**：元素无动态属性、type 是**原生元素字符串标签**、children 全静态 → 提升为模块级 `_hoisted_N` 常量，原位置替换为引用（render 每次返回同一对象 → 运行时 `oldVnode === newVnode` 短路跳过整个 diff）。**组件（标识符 type）不参与 hoist**（作用域可能不是模块级，且多实例共享有风险）。

**propsKeys 提升**：`["class","data-label"]` 这类动态 props 列表 → 模块级 `_propsKeys_N` 常量（避免每次 render 分配数组）。

### 2. jsx-runtime：flag 参数（`jsxFactory.ts`）

```ts
jsx(type, props, key?, patchFlag?, propsKeys?)  // jsxs 同
```

VNode 增加 `__patchFlag`（数字）/ `__propsKeys`（数组），未传时行为不变（向后兼容）。

### 3. renderer：按 flag 走最小路径（`renderer.ts`）

```ts
const flag = newVnode.__patchFlag
if (flag === undefined) { ...老路径（P0 值短路）... }
else {
  if (flag & PATCH_TEXT) {
    const c = newVnode.props?.children
    if (typeof c === 'string' || typeof c === 'number') {
      el.textContent = String(c)   // 只写文本，跳过 children diff
      textOnly = true
    }
  }
  if (flag & PATCH_PROPS) patchPropsKeyed(oldVnode.props, newVnode.props, el, newVnode.__propsKeys)
  if (textOnly) return
}
```

- **TEXT**：动态文本 children → 直接 `textContent`（跳过 children diff + 文本 vnode 创建）
- **PROPS**：`patchPropsKeyed` 只处理 `__propsKeys` 中的动态 key（值变才 `setProp`）
- **flag 0**：props 全静态 → 跳过 `patchProps`（首次 mount 后不再重设）

### 4. 共享与 attrs 兼容（`renderer.ts` / `mountComponent.ts`）

- **hoisted 多实例隔离**：`mountVNode` 遇到 `vnode.el != null`（已被其他实例挂载）→ 浅克隆，避免共享 VNode 的 `el` 槽位互相覆盖
- **patch 短路条件**：`oldVnode === newVnode` 短路加 `oldVnode.props === newVnode.props` 条件（hoisted 子树被 attrs fallthrough 原地改 props 后必须继续 patch）
- **mergeAttrsToRoot**：仅"实际可透传的 attrs"才 merge（避免空对象触发）；hoisted 根元素**先 clone + 记录 `__baseProps`**，每次从源码态合并（否则 class 会在被污染的基础上累积：`'body a' + 'b'` → `'body a b'` 而非 `'body b'`）；merge 后清除 `__patchFlag` 降级老路径

## 三、处理过的 Bug（6 个）

| # | Bug | 根因 | 修复 |
|---|---|---|---|
| 1 | 更新后 input.value 不更新（手动 `_jsx` 复现正常、组件链失败） | babel 编译 `_jsx(type, props, 2, ["value"])` —— **flag 错位到第 3 参（key 位）**（无 key 时未补占位） | `args.push(keyExpr ?? t.identifier('undefined'))` |
| 2 | `ReferenceError: Child is not defined`（verify 场景连锁失败） | hoist 把**引用局部组件**的静态子树（`<Child/>`）提升到模块级，作用域失效 | 仅原生元素（字符串 type）可 hoist；组件标识符不提升 |
| 3 | 文本内容多出换行/缩进（`'正文内容 '` vs `'正文内容'`） | JSXText 空白规则：babel 保留原样，esbuild 会折叠 | `processJsxText` 对齐 esbuild（头/尾/内部换行规则 + 实体解码） |
| 4 | `Property elements[0] expected JSXEmptyExpression`（Babel 校验失败） | `{/* 注释 */}` 的 JSXEmptyExpression 被当作 children | 空表达式过滤（元素与 Fragment 两处） |
| 5 | 大规模回退（18 → 101 失败），mount 全空 | `mergeAttrsToRoot` 主流程**末尾缺 `return subTree`** → 调用点 `newSubTree = undefined`；且 `attrs = {}`（truthy）误触发 clone | 补 return；仅实际可透传 attrs 才 merge |
| 6 | 选中行高亮/局部更新时事件不重绑（PROPS\|TEXT 组合） | patchVNode 的 TEXT 分支直接 `return`，跳过了同元素的动态 props patch | TEXT 只跳过 children diff（`textOnly`），PROPS 分支继续执行 |

> 另外：P0 后遗留的 `TestPage.tsx` 未使用参数（TS6133）在阶段一已顺手修复，非 P1 引入。

## 四、Benchmark 复测（count=3，3 轮确认）

| 基准 | P0 后 | P1 轮1 | P1 轮3（修复后） | vue |
|---|---|---|---|---|
| 03_update10th1k_x16 局部更新 | 43.0 | 46.5 | **46.1** | 23.9 |
| 04_select1k 选中高亮 | 27.4 | 31.0 | **30.7** | 8.6 |
| 06_remove-one-1k 删除 | 30.0 | 33.3 | **30.8** | 23.2 |

## 五、为什么数据页没提升（复盘）

1. **数据页几乎全是动态内容**：行的 td 含动态文本（`{row.id}`）、tr 的 class 动态、header 的 `onClick={run}` 引用组件作用域函数 —— hoist 无处发力；TEXT/PROPS flag 只省了 patch 阶段的小头。
2. **主成本是全量 render**：每次 update 重新执行 1000 行 `_jsx` 调用（VNode + props 对象 + children 数组分配）。flag 优化不触及 render；babel 编译的 `_jsx` 多传 flag/keys 参数反而让 render 略增（~10%）。
3. **P0 已把 patch 阶段的 DOM 写最小化**（值比较短路），flag 的增量收益有限。
4. Vue 在数据页快的关键：**行组件化 + props 引用短路** + 更激进的编译优化（静态属性提升、`v-memo` 等）。

## 六、结论与后续方向

- **P1 的价值**：① 正确性（修复 6 个潜在 bug，含 PROPS|TEXT 组合吞事件、hoist 共享污染等真实缺陷）；② 静态内容多的场景（文档页/表单/布局）的 hoist + TEXT 收益；③ **编译期标记体系已建立**——`__patchFlag`/`__propsKeys`/hoist 机制就位，是后续深化的地基。
- **后续（P2 候选）**：
  - **静态属性提升**：`<td class="col-md-1">` 的 props 对象提升为常量（`_jsx("td", _hoistedProps1, ...)`），render 省对象分配 + props 引用短路（需把 children 从 props 拆出或扩展 jsx 签名）
  - **行模板缓存 / 组件化行**：对 benchmark 的 map 列表，识别稳定行结构
  - **`createStaticVNode` 批量块**：纯静态大块一次性 innerHTML
- **回归保障**：220 测试全绿、tsc/vite build 通过；babel 插件测试断言已更新为新输出形态。
