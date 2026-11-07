# ActView 发布流程（changesets + GitHub Actions）

按变更检测发布：**只有发生变更的包（及其依赖方）才会 bump 并发布新版本**。
本地用 [`@changesets/cli`](https://github.com/changesets/changesets) 记录变更，线上由
[`.github/workflows/release.yml`](../.github/workflows/release.yml) 自动发布到 npm。

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

推送到 `master`（或在 Actions 页面手动触发 `Release`）后：

- 存在带 release 的 changeset → 生成 / 更新 **Version Packages** PR（只改版本号）；
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
| Organization or user | `ALiuYiLin` |
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
npm trust github actview --repo ALiuYiLin/actview --file release.yml --yes
# 其余包同样执行，把 actview 换成对应包名
```

注意：

- 工作流文件名必须与 `.github/workflows/release.yml` 完全一致；以后重命名工作流文件，
  必须回来更新这里，否则 OIDC 校验失败。
- 已创建的信任配置不能修改、只能删除重建。

### 2. 打开仓库 Actions 的 PR 权限

GitHub 仓库 → Settings → Actions → General → 勾选
**Allow GitHub Actions to create and approve pull requests**。
否则 `version` job 无法创建 Version Packages PR（报
`GitHub Actions is not permitted to create or approve pull requests`）。

### 3. 第一次推送会发生什么

仓库里已有 2 个未发布的 changeset（`core-renderer-vue-align.md` 给 core minor，
`peer-range-unify.md` 给 actview/router/store/testing/hooks-react/devtools patch），
所以第一次推送 `release.yml` 会走 **version** 模式：创建 / 更新 Version Packages PR，

预期 bump 结果（仅版本号变化）：

| 包 | 当前 | Version PR 后 |
| --- | --- | --- |
| `@actview/core` | 1.4.4 | 1.5.0（minor） |
| `actview` | 4.0.0 | 4.0.1（patch） |
| `@actview/router` | 1.0.16 | 1.0.17 |
| `@actview/hooks-react` | 1.1.1 | 1.1.2 |
| `@actview/store` | 0.0.4 | 0.0.5 |
| `@actview/testing` | 0.1.1 | 0.1.2 |
| `@actview/devtools` | 0.0.4 | 0.0.5 |

合并该 PR 后，下一次 push 走 publish 模式：发布上表的新版本，并顺带发布已对齐但
不在 changeset 里的 `@actview/plugin-babel@2.2.1` 和 `@actview/plugin-vite@1.3.1`。

> 因为 actview 有一条 pending 的 patch changeset，`actview@4.0.0` 这个中间版本不会
> 单独出现在 npm 上，实际首发是 `4.0.1`（`^4.0.0` 照常可用）。若希望首发正好是
> `4.0.0`，删掉 `peer-range-unify.md` 里 `'actview': patch` 一行再推送即可。

**所以请先完成第 1 步（配置 npm Trusted Publisher）再推送**，否则合并 Version PR
后的发布步骤会因 OIDC 校验失败而中止。

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
- `Resource not accessible by integration`（version job）：没打开上面的
  “允许 GitHub Actions 创建和批准 PR”。
- `404`（publish）：包在 npm 上还不存在；Trusted Publishing 不能发布第一个版本，
  需要先本地手动发布。
- 想退回 token 方式：在仓库 Secrets 中加 `NPM_TOKEN`，把 `publish` job 改为
  `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`，并在 `setup-node` 中设置
  `registry-url: https://registry.npmjs.org`。
