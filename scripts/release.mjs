// ============================================================
// 根目录一键发布：按依赖顺序发布「版本有变化」的包
//   对比本地 package.json 的 version 与 npm registry 最新版本，
//   本地更高（或从未发布）=》 执行 pnpm build && npm publish
// 用法：
//   npm run release            # 正式发布
//   npm run release -- --dry-run   # 干跑：只打印要发布的包，不真正构建/发布
// 注意：版本号（npm version patch）请手动维护；发布前需 npm 登录（.npmrc token）
// ============================================================

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 发布顺序 = 依赖顺序（先发被依赖的包）
const PACKAGES = [
  { dir: 'packages/jsx', name: '@actview/jsx' },
  { dir: 'packages/core', name: '@actview/core' },
  { dir: 'plugins/babel-plugin-actview', name: '@actview/babel-plugin-actview' },
  { dir: 'plugins/plugin-vite', name: '@actview/plugin-vite' },
  { dir: 'plugins/plugin', name: '@actview/plugin' },
  { dir: 'packages/router', name: '@actview/router' },
  { dir: 'packages/actview', name: 'actview' },
]

const DRY_RUN = process.argv.includes('--dry-run')

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  if (DRY_RUN) return
  return execSync(cmd, { stdio: 'inherit', ...opts })
}

function readVersion(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  return pkg.version
}

/** 读取 registry 最新版本；未发布返回 null */
function registryVersion(name) {
  try {
    const out = execSync(`npm view ${name} version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim()
  } catch {
    return null
  }
}

/** 简单 semver 比较：local > remote */
function gt(local, remote) {
  if (remote == null) return true
  const a = local.split('.').map(Number)
  const b = remote.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}

console.log(DRY_RUN ? '[dry-run] 仅检查，不执行构建与发布\n' : '开始发布检查\n')

let toPublish = 0
for (const p of PACKAGES) {
  const local = readVersion(p.dir)
  const remote = registryVersion(p.name)
  const changed = gt(local, remote)
  console.log(`=== ${p.name}  本地 ${local} / registry ${remote ?? '未发布'} ${changed ? '=》 需发布' : '（无变化，跳过）'} ===`)

  if (!changed) continue
  toPublish++

  run(`pnpm build`, { cwd: p.dir })
  run(`npm publish`, { cwd: join(p.dir, 'dist') })
}

console.log(`\n${DRY_RUN ? '[dry-run] 检查完成：' : '发布完成：'}${toPublish} 个包${DRY_RUN ? '需要' : '已'}发布`)
