---
'@actview/core': minor
---

调度器对齐 Vue scheduler：双层队列 + job 排序 + 递归更新检测（P2-4）

- **主队列按 id 升序**（ReactiveEffect 增加创建序 id，父组件先创建 id 小）：
  queueJob 去重 + 排序插入（对齐 Vue findInsertionIndex）——父子同时依赖
  同一状态时父先于子更新。
- **pre 队列**：watch flush:'pre'（默认）经 queuePreFlushCb 入队，
  在组件更新前执行（此前依赖各自微任务注册顺序，时序不确定）。
- **post 队列（一次性）**：watch flush:'post' 经 queuePostFlushCb 入队，
  渲染提交（DOM 已更新）后执行；常驻 post-flush 钩子 registerPostFlushHook
  保留（受控还原）。
- **递归更新检测**：单轮内同一 job 执行超 100 次（对齐 Vue RECURSION_LIMIT）
  → console.warn 告警并跳过（防 effect 修改自身依赖导致的无限循环）。
- flushJobs 重构：数组队列 + shift 执行 + 执行中新入队下轮继续
  （避免深栈递归）。
- 行为变化：组件更新顺序从「触发序」变为「组件树序（父先子后）」（对齐 Vue）。
- 测试：test/reactivity/scheduler-p2-4.test.tsx（5 用例：父先子后 / pre 先于
  组件更新 / post 在 DOM 更新后 / 批处理去重 / 递归检测告警）；全量 578 用例通过。
