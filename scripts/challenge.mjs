#!/usr/bin/env node
// ============================================================
// challenge — ActView 挑战 CLI
//   list               列出全部挑战
//   run <id>           判题（跑用户 solution）
//   verify-all         用参考实现自检所有题目本身可解
//   new <id>           脚手架生成新挑战
//   show <id>          显示题目说明
// ============================================================

import { execSync } from 'node:child_process'
import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const challengesDir = path.join(root, 'challenges')

function getChallengeIds() {
  if (!existsSync(challengesDir)) return []
  return readdirSync(challengesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** 从 challenge.ts 提取 meta（正则轻解析，字段均为字面量） */
function readMeta(id) {
  const file = path.join(challengesDir, id, 'challenge.ts')
  if (!existsSync(file)) return null
  const src = readFileSync(file, 'utf8')
  const grab = (key) => {
    const m = src.match(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`))
    return m ? m[1] : ''
  }
  const tagsMatch = src.match(/tags:\s*\[([^\]]*)\]/)
  const tags = tagsMatch
    ? [...tagsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
    : []
  return {
    id,
    title: grab('title') || id,
    difficulty: grab('difficulty') || '?',
    tags,
    solved: existsSync(path.join(challengesDir, id, '.solved'))
  }
}

function cmd() {
  const [sub, arg] = process.argv.slice(2)
  switch (sub) {
    case 'list': {
      const ids = getChallengeIds()
      if (!ids.length) {
        console.log('（无挑战，先运行 pnpm challenge new <id>）')
        return
      }
      console.log('ActView 挑战列表：\n')
      for (const id of ids) {
        const m = readMeta(id)
        console.log(
          `  ${m.solved ? '✅' : '⬜'} ${id.padEnd(24)} [${m.difficulty}] ${m.title}` +
            (m.tags.length ? `  (${m.tags.join(', ')})` : '')
        )
      }
      console.log('\n运行：pnpm challenge run <id>')
      return
    }
    case 'show': {
      if (!arg) return usage()
      const m = readMeta(arg)
      if (!m) {
        console.log(`挑战不存在：${arg}`)
        process.exit(1)
      }
      console.log(`# ${m.title}  [${m.difficulty}]  (${m.tags.join(', ')})\n`)
      const readme = path.join(challengesDir, arg, 'README.md')
      if (existsSync(readme)) console.log(readFileSync(readme, 'utf8'))
      console.log('--- 模板（solution.tsx）---\n')
      const sol = path.join(challengesDir, arg, 'solution.tsx')
      if (existsSync(sol)) console.log(readFileSync(sol, 'utf8'))
      return
    }
    case 'run': {
      if (!arg) return usage()
      if (!existsSync(path.join(challengesDir, arg))) {
        console.log(`挑战不存在：${arg}（pnpm challenge list 查看）`)
        process.exit(1)
      }
      runVitest([`challenges/${arg}/challenge.test.ts`], { run: true })
      return
    }
    case 'verify-all': {
      runVitest(['challenges'], { reference: true })
      return
    }
    case 'new': {
      if (!arg) return usage()
      scaffold(arg)
      return
    }
    case 'solved': {
      if (!arg) return usage()
      const solvedFile = path.join(challengesDir, arg, '.solved')
      if (!existsSync(path.join(challengesDir, arg))) {
        console.log(`挑战不存在：${arg}`)
        process.exit(1)
      }
      if (process.argv[3] === '--undo') {
        if (existsSync(solvedFile)) {
          rmSync(solvedFile)
          console.log(`已取消标记：${arg}`)
        }
      } else {
        writeFileSync(solvedFile, new Date().toISOString())
        console.log(`已标记完成：${arg}`)
      }
      return
    }
    default:
      return usage()
  }
}

function runVitest(filters, opts = {}) {
  const env = { ...process.env }
  if (opts.run) env.CHALLENGE_RUN = '1'
  if (opts.reference) env.CHALLENGE_REFERENCE = '1'
  try {
    execSync(`pnpm vitest run ${filters.join(' ')}`, {
      stdio: 'inherit',
      cwd: root,
      env
    })
  } catch {
    // vitest 非零退出：断言失败/编译错误，输出已在 stdio 展示
    process.exitCode = 1
  }
}

/** 脚手架：生成新挑战目录（challenge.ts 的 verify 需人工补断言） */
function scaffold(id) {
  const dir = path.join(challengesDir, id)
  if (existsSync(dir)) {
    console.log(`目录已存在：${dir}`)
    process.exit(1)
  }
  mkdirSync(dir, { recursive: true })

  const files = {
    'README.md': `# ${id}

**难度**：easy ｜ **标签**：reactivity

## 题目

（补全题目说明）

## 掌握点

- （补全）

## 运行

\`\`\`bash
pnpm challenge run ${id}
\`\`\`
`,
    'challenge.ts': `// ${id} — 挑战定义（断言部分：框架保留，勿改）
import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: '${id}',
  title: '（补全标题）',
  difficulty: 'easy',
  tags: ['reactivity'],
  description: \`（补全题目说明）\`,
  template: \`// TODO 用户模板
export function solve() {
  // TODO
}\`,
  verify(ctx) {
    const { solution, assert } = ctx
    const { solve } = solution
    assert.truthy('导出了 solve', typeof solve === 'function')
    // TODO 补全行为断言
  }
})
`,
    'solution.tsx': `// TODO 用户填写：完成题目要求的实现
export function solve() {
  // TODO
}
`,
    'solution.reference.tsx': `// 参考实现（verify-all 自检用）
export function solve() {
  // TODO
}
`,
    'challenge.test.ts': `// ============================================================
// 判题入口（框架保留，勿改）
//   CHALLENGE_REFERENCE=1 时用参考实现自检（verify-all）
// ============================================================

import { it, expect } from 'vitest'
import { runChallenge, formatResult } from '@actview/challenges'
import challenge from './challenge'

let solution: Record<string, unknown>
if (process.env.CHALLENGE_REFERENCE === '1') {
  solution = await import('./solution.reference.tsx')
} else {
  solution = await import('./solution.tsx')
}

it(\`challenge: \${challenge.id}\`, async () => {
  const result = await runChallenge(challenge, solution)
  expect(result.pass, formatResult(result)).toBe(true)
})
`
  }
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content)
  }
  console.log(`已创建挑战：${id}`)
  console.log(`  编辑 ${id}/solution.tsx 填写实现`)
  console.log(`  补全 ${id}/challenge.ts 的 verify 断言`)
  console.log(`  运行 pnpm challenge run ${id} 判题`)
}

function usage() {
  console.log(
    `用法：pnpm challenge <command> [args]

  list                列出全部挑战
  show <id>           显示题目说明与模板
  run <id>            判题（跑用户 solution，正确通过 / 失败显示报错信息）
  verify-all          用参考实现自检所有题目本身可解
  new <id>            脚手架生成新挑战
  solved <id> [--undo] 标记/取消标记挑战完成（list 显示 ✅）`
  )
}

cmd()
