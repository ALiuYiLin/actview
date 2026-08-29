---
'@actview/core': minor
---

受控输入机制改进（7.2）+ select/textarea 表单归一（P2-3）

- **渲染提交兜底还原**：受控元素注册表 + 调度器常驻 post-flush 钩子
  （reactive-system `registerPostFlushHook`，每次 flushJobs 末尾执行）——
  受控 value/checked 在**每次渲染提交后**统一检查拉回，覆盖自动填充/脚本改 DOM
  等非事件场景（此前仅 input/change 事件后检查，触发面窄）。
- **toString 归一**：还原比较前 `String()` 归一（value={5} 时 el.value("5") === "5"
  不拉回，消除 number/boolean 造成的多余 DOM 写与光标重置）。
- **select 受控值**：value → option selected（单值 + multiple 数组）；
  未匹配清空选中；children（options）挂载后再应用。
- **textarea children → value**：children 是 value 的声明形态，不渲染为文本节点；
  无 value prop 时 children 文本作初始值（React 语义）。
- **hydrate 不覆盖用户输入**：水合时受控 input/select/textarea 只记录标记、
  不写 value/checked DOM（React trackHydrated 语义）。
- **受控仅限表单控件**：`<option value>` 等非表单元素不再注册受控还原
  （此前 option 也会进注册表，污染还原遍历）。
- 调度器新增 `registerPostFlushHook`（常驻，每次 flush 执行；区别于一次性队列）。
- 测试：test/platform-diff/controlled-form.test.tsx（11 用例：select 单值/multiple/
  未匹配、textarea children、toString 归一、渲染兜底/卸载清理、hydrate 不覆盖、
  radio 受控组）；全量 573 用例通过。
