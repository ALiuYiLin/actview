// ============================================================
// 构建辅助：把包的 package.json 拷贝到 dist/，exports 指向构建产物
// 用法：node scripts/rewrite-package.mjs <package-dir>
//   读 <package-dir>/package.json =》 写 <package-dir>/dist/package.json
//   - 保留 name/version/dependencies 等发布所需字段
//   - 去掉 private（npm 不允许发布 private 包）
//   - exports 每个子路径指向 dist/<name>.js + .d.ts
//   - 补充 main/module/types（兼容非 exports 环境）
//   - workspace:* 依赖 =》 ^<对应包版本>（npm 不识别 workspace 协议）
// ============================================================

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const pkgDir = resolve(process.argv[2])
if (!pkgDir) {
  console.error('用法: node scripts/rewrite-package.mjs <package-dir>')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))

// ---------- 收集 workspace 包版本（name =》 version） ----------
function collectWorkspaceVersions(startDir) {
  const versions = new Map()
  let dir = startDir
  while (true) {
    for (const sub of ['packages', 'plugins']) {
      const base = join(dir, sub)
      if (!existsSync(base)) continue
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const p = join(base, entry.name, 'package.json')
        if (existsSync(p)) {
          const meta = JSON.parse(readFileSync(p, 'utf8'))
          if (meta.name && meta.version) versions.set(meta.name, meta.version)
        }
      }
    }
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) break
    const parent = dirname(dir)
    if (parent === dir) break // 到达文件系统根（Windows 上 dirname('E:\\') === 'E:\\'）
    dir = parent
  }
  return versions
}

const wsVersions = collectWorkspaceVersions(pkgDir)

function rewriteDeps(deps) {
  if (!deps) return deps
  const out = {}
  for (const [name, range] of Object.entries(deps)) {
    if (range === 'workspace:*') {
      const v = wsVersions.get(name)
      out[name] = v ? `^${v}` : '*'
      if (!v) console.warn(`  [warn] workspace 版本未知: ${name}，使用 "*"`)
    } else {
      out[name] = range
    }
  }
  return out
}

const distPkg = { ...pkg }
delete distPkg.private
delete distPkg.devDependencies
distPkg.main = './index.js'
distPkg.module = './index.js'
distPkg.types = './index.d.ts'

if (distPkg.dependencies) distPkg.dependencies = rewriteDeps(distPkg.dependencies)
if (distPkg.peerDependencies) distPkg.peerDependencies = rewriteDeps(distPkg.peerDependencies)

// exports：子路径（"." =》 index）映射到 dist 产物
const distExports = {}
for (const [subpath] of Object.entries(pkg.exports || {})) {
  const name = subpath === '.' ? 'index' : subpath.replace(/^\.\//, '')
  distExports[subpath] = {
    types: `./${name}.d.ts`,
    import: `./${name}.js`,
  }
}
distPkg.exports = distExports

const out = join(pkgDir, 'dist/package.json')
writeFileSync(out, JSON.stringify(distPkg, null, 2) + '\n')
console.log(`[rewrite-package] ${pkg.name} =》 ${out}`)
console.log('  exports:', JSON.stringify(distExports, null, 2))
if (distPkg.dependencies) console.log('  dependencies:', JSON.stringify(distPkg.dependencies))
