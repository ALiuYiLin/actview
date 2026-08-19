# ActView 挑战系统（challenges）

LeetCode 式框架练习：**题目保留断言，用户填实现**，判题黑盒验收
"对框架 API 的正确使用"（行为，而非内部实现）。

## 快速开始

```bash
pnpm challenge list                  # 查看全部挑战
pnpm challenge show reactivity-ref   # 查看题目说明与模板
pnpm challenge run reactivity-ref    # 判题：正确 PASS / 失败显示报错信息
pnpm challenge verify-all            # 用参考实现自检所有题目本身可解
pnpm challenge new <id>              # 脚手架生成新挑战
pnpm challenge solved <id>           # 标记完成（list 显示 ✅）
```

## 目录结构

```
challenges/<id>/
  README.md              题目说明（给用户看）
  challenge.ts           defineChallenge 定义（断言部分：框架保留）
  solution.tsx           用户填写（初始为 TODO 模板）
  solution.reference.tsx 参考实现（verify-all 自检用）
  challenge.test.ts      判题入口（框架保留，勿改）
```

## 判题流程

1. `pnpm challenge run <id>` → vitest 以 `CHALLENGE_RUN=1` 运行 `challenge.test.ts`
2. 测试文件 import 用户 `solution.tsx`（babel 插件转换 JSX/组件）+ `challenge.ts`
3. `runChallenge(challenge, solution)` 执行框架保留的 `verify(ctx)`：
   - 断言逐条收集（失败不抛，收集全部失败点）
   - 用户代码运行抛错 → 判为 `exec` 阶段错误（带堆栈）
   - 断言未通过 → `verify` 阶段，输出每条 ✗ + 期望/实际 + 框架提示 💡
4. 结果 `{ pass, stage, checks, error?, durationMs }` 格式化输出

> 无环境变量时挑战测试自动跳过（`it.skipIf`），普通 `pnpm test` 不判题。

## 题目设计原则

- **考"正确使用框架"**：模板给组件/函数签名 + 场景描述，用户用框架 API 完成，
  不实现框架 API 本体
- **黑盒行为验收**：verify 断言渲染结果、交互、**props 更新后是否响应**
  （直接解构 props 会丢失响应性 → 断言失败并提示用 useProps）
- **失败给框架语义提示**：每条断言可带 `hint`，引导用户理解框架心智模型
- **题目本身可解**：每道题配参考实现，`verify-all` 持续自检

## verify 上下文（ctx）

```ts
interface VerifyContext {
  solution: Record<string, unknown>   // 用户 solution 的命名导出
  actview: typeof import('@actview/core')  // 完整框架 API
  render: (component, { props }) => { container, setProps, getByText, ... }
  fireEvent, waitFor, nextTick        // 交互与异步
  assert: { text, class, testId, truthy, equal, count }  // 逐条断言
}
```

### 组件题渲染辅助

`render(Component, { props })` 通过包装组件把 props 传入用户组件；
`setProps(next)` 就地写入 shallowReactive props → 触发重渲染 →
**验收 props 更新后视图是否同步**（框架理解的核心考点）。

## 新增题目

```bash
pnpm challenge new my-challenge
```

然后补全 `challenge.ts` 的 verify 断言与参考实现，跑 `verify-all` 确认可解。

## 依赖

- 判题引擎：`packages/challenges`（`@actview/challenges`）
- 复用：`@actview/core`（框架）、`@actview/jsx`（createElement）、
  `@actview/testing`（fireEvent/waitFor）
