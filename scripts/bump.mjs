// 统一版本 bump 脚本：node scripts/bump.mjs <patch|minor|major>
// 只改 10 个发布包的 version（根 private 包不动），bump 后自动提交，由调用方继续 pnpm -r publish。
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const type = process.argv[2]
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('用法: node scripts/bump.mjs <patch|minor|major>')
  process.exit(1)
}

const targets = [
  'packages/core/package.json',
  'packages/actview/package.json',
  'packages/router/package.json',
  'packages/jsx/package.json',
  'packages/store/package.json',
  'packages/testing/package.json',
  'packages/devtools/package.json',
  'plugins/babel/package.json',
  'plugins/scoped/package.json',
  'plugins/vite/package.json',
]

function bump(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const changed = []
for (const rel of targets) {
  const file = join(root, rel)
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  const from = pkg.version
  pkg.version = bump(from, type)
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  changed.push(`${pkg.name}: ${from} -> ${pkg.version}`)
}

execSync(`git add ${targets.join(' ')}`, { cwd: root, stdio: 'inherit' })
execSync(`git commit -m "chore(release): 所有包 ${type} bump (${changed.join(', ')})"`, { cwd: root, stdio: 'inherit' })

console.log(changed.join('\n'))
console.log('\n版本已 bump 并提交，接下来执行 pnpm -r publish（workspace:^ 依赖会自动记录为新版本区间）')