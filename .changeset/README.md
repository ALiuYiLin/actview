# ActView 发布流程（changesets 按变更检测）

不再手动全量 bump 版本：**只有发生变更的包（及其依赖方）才会发布新版本**。

## 日常开发

改动代码后，为本次改动登记一个变更集（选择影响的包与 bump 类型）：

```bash
pnpm changeset
```

- 交互式多选**本次改动的包**（未改动的包不要选，它们不会被 bump）
- 选 bump 类型：`patch`（bug 修复）/ `minor`（新功能）/ `major`（breaking）
- 生成 `.changeset/<随机名>.md` 变更记录，**随代码一起提交**

> 跨包协议变更（如 plugin-scoped 依赖 core 运行时的 `scopedId` 翻译）：
> 为**涉及的每个包**都勾选同一个变更集，保证它们同批发布。

## 发布前检查

```bash
pnpm changeset:status   # 查看待发布的变更集
```

## 发布

```bash
pnpm release            # = changeset version && changeset publish
```

分两步（也可分开执行）：

1. `pnpm changeset:version` — 按变更集精确计算版本：
   - 有变更集的包：按其 bump 类型升版本
   - 依赖它们的包：按 `updateInternalDependencies: patch` 联动 patch bump
     （`workspace:^` 区间内的 patch 变更不触发联动——core patch 无需重发 actview）
   - 自动 `git commit`（config `commit: true`），提交名 `RELEASING: ...`
2. `pnpm changeset:publish` — 只发布本次 bump 的包（拓扑序，`prepublishOnly` 自动构建）

## 与 workspace:^ 的配合

- 发布时 pnpm 把 `workspace:^` 替换为 `^新版本`，跨包依赖可浮动解析；
- 因此 core 的 patch 修复**不需要**重发 actview/router 等，用户 `pnpm update` 即得新 core；
- 只有超出区间（minor/major）或依赖方自身有变更时才联动 bump 依赖方。

## 旧脚本已移除

- `release:patch` / `release:minor` / `release:major`（全量 bump，与按变更检测冲突）
- `scripts/bump.mjs`（同上）
