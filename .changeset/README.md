# ActView 发布流程（changesets + GitHub Actions）

按变更检测发布：**只有发生变更的包（及其依赖方）才会 bump 并发布新版本**。
本地用 [`@changesets/cli`](https://github.com/changesets/changesets) 记录变更，线上由
[`.github/workflows/release.yml`](../.github/workflows/release.yml) 自动发布到 npm。

## 分支模型（main 集成 → master 发布）

```
fix/xxx  feat/xxx
   │ push + 开 PR（CI：构建 + 测试，不发布）
   ▼
  PR → main          # 集成分支：CI 必须绿；可先在 main 上预演 / 试用
   │
   │ 手动 PR（你决定发版时）
   ▼
 master              # 发布分支：只接受来自 main 的 PR
   │ push → release.yml
   ├─ 有 changeset → Version Packages PR → 合并 → npm publish + tag / GitHub Release
   └─ 无 changeset → 什么都不做
   │
   └─ 发布成功后 → sync-main job 自动把 master 回合并到 main
```

- **CI**（[ci.yml](../.github/workflows/ci.yml)）只在 `pull_request` 指向 `main` /
  `master` 时触发：
  - 只有改到 `packages/**`、`plugins/**`、`test/**` 或根构建配置（`package.json`、
    `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`vite.config.ts`、`tsconfig*.json`、
    `ci.yml` 自身）时才跑 `install → build:packages → test`；
  - 纯文档 / `.changeset` 等改动的 PR 只做变更检测，job 仍快速成功上报
    （保证分支保护的 required check 不会卡住 PR）；
  - **Version Packages PR**（`changeset-release/*`）不跑重活，发布前 `Release` 的
    `pack` 阶段会再构建 + 测试一次；
  - 权限只有 `contents: read`，不发布。**分支 push 不再触发任何 workflow。**
- **发布**只由 `master` 的 push 触发。feature 分支和 `main` 上的改动都**不会**发 npm。
- 想发版：开 PR `main → master` 合并 → Release 判定 →（有 changeset 时）合并
  Version Packages PR 才真正 publish。
- 发布完成后 `sync-main` job 自动执行 `git merge origin/master` 并 push 回 `main`，
  避免下次 `main → master` 在 `package.json` 版本号 / `CHANGELOG.md` / `.changeset/`
  上冲突。该 push 用 `GITHUB_TOKEN`，**不会再触发 CI**（GitHub 对 token 触发的事件去重）；
  内容已在 pack 阶段构建 + 测试过。
- 热修复：允许直接开 PR → `master` 发 patch，发布后同样自动回合并到 `main`。

### 分支保护（GitHub 设置，建议）

| 分支 | 建议 |
| --- | --- |
| `main` | 要求 `Build & test` 检查通过（可以不开“Require a pull request”） |
| `master` | 只允许 PR 合并：Version Packages PR 由 bot 创建、你手动 approve |

> ⚠️ 如果给 `main` 开启 **Require a pull request before merging**，`sync-main` 的
> 直接 push 会被拦截，release 运行会显示失败（但 npm 发布已经成功）。此时三选一：
> 关闭该选项、在 ruleset 里允许 GitHub Actions bypass、或把 `sync-main` 改成用
> PAT（`secrets.SYNC_TOKEN`）推送。

## 日常开发

改动代码后，为本次改动登记一个变更集：

```bash
pnpm changeset
```

- 交互式多选**本次改动的包**（未改动的包不要选，它们不会被 bump）
- 选 bump 类型：`patch`（bug 修复）/ `minor`（新功能）/ `major`（breaking）
- 生成 `.changeset/<随机名>.md` 变更记录，**随代码一起提交**

> 跨包协议变更（例如 plugin-scoped 依赖 core 运行时的 `scopedId` 翻译）：
> 为**涉及的每个包**都勾选同一个变更集，保证它们同批发布。

查看待发布的变更集：

```bash
pnpm changeset:status
```

## 发布流程（GitHub Actions 自动，推荐）

只有推送到 `master`（或在 Actions 页面手动触发 `Release`）才进入发布判定；
`main` 和 feature 分支的 push 不再触发 CI（只有 PR 才跑），也都不发版。

推送到 `master` 后：

- 存在带 release 的 changeset → 生成 / 更新 **Version Packages** PR（版本号 + 各包
  `CHANGELOG.md`）；
- 没有 changeset 但存在 registry 上还没有的版本 → 构建 `dist/`、跑 `pnpm test`，
  然后打包并发布到 npm，推送 git tag、创建 GitHub Release；
- 两者都没有 → 什么都不做。

发布使用 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)（OIDC），
仓库里不保存 `NPM_TOKEN`；通过 OIDC 发布时会自动附带 provenance 证明
（需要公开仓库 + 公开包 + OIDC 发布三者同时满足）。

日常只需要：`pnpm changeset` → 提交并推送 → 等 CI 开 Version Packages PR → 合并即发布。

## 一次性配置（首次启用前必须做）

### 0. 版本已对齐（本次已完成）

`master` 曾回退到 `940f89e`，本地版本一度低于 npm 上的 latest；直接发布会让 npm
latest 回退到低版本。本仓库已完成对齐，之后由 changesets 正常递增：

| 包 | 对齐后版本 | npm 原 latest |
| --- | --- | --- |
| `actview` | `4.0.0` | `3.2.1` |
| `@actview/plugin-babel` | `2.2.1` | `2.2.0` |
| `@actview/plugin-vite` | `1.3.1` | `1.3.0` |

其余 8 个包本地版本与 npm latest 一致。

### 1. 在 npmjs.com 配置 Trusted Publisher

打开每个包的 Settings → **Trusted publishing**，选 **GitHub Actions** 并填写：

| 字段 | 值 |
| --- | --- |
| Organization or user | `actview` |
| Repository | `actview` |
| Workflow filename | `release.yml`（只填文件名，不带路径） |
| Environment name | 留空 |
| Allowed actions | 必须勾选 **`npm publish`** |

需要逐个配置的包（11 个）：

`actview`、`@actview/core`、`@actview/devtools`、`@actview/hooks-react`、
`@actview/jsx`、`@actview/router`、`@actview/store`、`@actview/testing`、
`@actview/plugin-babel`、`@actview/plugin-scoped`、`@actview/plugin-vite`

> `Allowed actions` 必须包含 `npm publish`：2026-09-03 之后新建的配置默认只允许
> `npm stage publish`（暂存发布需要人工 2FA 审批），而 Changesets 是直接发布，
> 不勾选会发布失败。

也可以用命令行（npm ≥ 11.10，需要 2FA 确认，包必须先存在）：

```bash
npm login --registry=https://registry.npmjs.org
npm trust github actview --repo actview/actview --file release.yml --yes
# 其余包同样执行，把 actview 换成对应包名
```

注意：

- 工作流文件名必须与 `.github/workflows/release.yml` 完全一致；以后重命名工作流文件，
  必须回来更新这里，否则 OIDC 校验失败。
- 已创建的信任配置不能修改、只能删除重建。
- **仓库已从个人账号迁移到 `actview` 组织**：Trusted Publisher 绑定的是 **owner/repo**，
  旧的 `ALiuYiLin/actview` 配置会因 OIDC 校验失败而无法再发布。需要在 npm 上**删除旧配置、
  按 `actview/actview` 重建**（重建后需在 2 天内完成一次成功发布，可用 pending changeset 触发）。
- 各包 `package.json` 的 `repository.url` 已统一改为 `git+https://github.com/actview/actview.git`；
  npm provenance 会校验它与实际运行发布的仓库一致，**不要改回旧地址**。

### 2. 打开仓库 Actions 的 PR 权限

GitHub 仓库 → Settings → Actions → General → 勾选
**Allow GitHub Actions to create and approve pull requests**。
否则 `version` job 无法创建 Version Packages PR（报
`GitHub Actions is not permitted to create or approve pull requests`）。

> 仓库迁移到组织后，如果组织级 Actions 策略做了限制，还需要组织 Owner 在
> **Org Settings → Actions → General → Workflow permissions** 里一并允许，否则同样报错。

### 3. 当前发布状态（仓库迁移后）

最近一次发布（2026-11-07，发生在迁移到 `actview` 组织**之前**）：`actview@4.0.2`、
`@actview/router@1.0.18`、`@actview/store@0.0.6`、`@actview/testing@0.1.3`、
`@actview/hooks-react@1.1.3`、`@actview/devtools@0.0.6`。

- 这些版本的 npm 元数据里 `repository` 仍是旧的 `ALiuYiLin/actview`（发布发生在迁移前）；
  **下一次发布起**才会带上新的 `actview/actview` 地址。
- 当前 `master` 上没有 pending changeset。
- 迁移后第一次发布前，务必先按上面的新 owner 重建 Trusted Publisher，否则 `publish`
  步骤会因 OIDC 校验失败而中止。

## 发布流程（本地手动，备用）

`.changeset/config.json` 现在是 `commit: false`（与 GitHub Actions 配合，由 action 统一提交），
所以本地 `changeset version` 只改文件、不会自动提交：

```bash
pnpm changeset:version   # 按 changeset 计算版本号（只改文件）
git add . && git commit -m "chore: release"
pnpm changeset:publish   # 发布 registry 上尚不存在的版本（prepublishOnly 自动构建）
```

`pnpm release`（= `version && publish`）仍可用于快速本地发布。

## 排错

- `EOTP` / `401 Unauthorized` / `need auth`：Trusted Publisher 的仓库、工作流文件名
  或 Environment 对不上，或 `Allowed actions` 没勾 `npm publish`，或配置已过期。
- `Error: GitHub Actions is not permitted to create or approve pull requests` /
  `Resource not accessible by integration`（version job）：没打开上面的
  “Allow GitHub Actions to create and approve pull requests”
  （Settings → Actions → General → Workflow permissions 里勾选并 Save）。
- `404`（publish）：包在 npm 上还不存在；Trusted Publishing 不能发布第一个版本，
  需要先本地手动发布。
- version job 报 `Error: ENOENT: no such file or directory, open '.../packages/<pkg>/CHANGELOG.md'`：
  `.changeset/config.json` 的 `changelog` 被设成了 `false`。`changesets/action` 的
  version 步骤升完版本后会读取各包 `CHANGELOG.md` 拼 PR 内容，因此必须保留
  changelog 生成器（当前为 `"@changesets/cli/changelog"`）。
- 想退回 token 方式：在仓库 Secrets 中加 `NPM_TOKEN`，把 `publish` job 改为
  `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`，并在 `setup-node` 中设置
  `registry-url: https://registry.npmjs.org`。
