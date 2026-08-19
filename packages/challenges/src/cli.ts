#!/usr/bin/env node
// ============================================================
// @actview/challenges — CLI
//   题目库内置在包内（challenges/<id>/），用户只做取题/做题/交验：
//     new <id> [--dir <path>]    下发题目模板到 <path>/<id>/（默认 ./challenges）
//     verify <id> [--dir <path>] 判题：读取用户 solution，跑包内断言
//     verify-all                 用参考实现自检所有题目本身可解
//     list                       列出包内题目库
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileTsx } from './compile'
import { setupDom, executeCompiled } from './sandbox'
import { runChallenge } from './runner'
import { formatResult } from './format'
import type { Challenge } from './types'

// 包内题目库目录（dist/cli.js 与 challenges/ 同级；开发时 src/cli.ts 同构）
const LIB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../challenges')

export function usageText(): string {
  return `@actview/challenges — ActView 挑战 CLI

用法：
  challenges new <id> [--dir <path>]    下发题目模板（默认生成到 ./challenges/<id>/）
  challenges verify <id> [--dir <path>] 判题：正确 PASS / 失败显示报错信息
  challenges verify-all                用参考实现自检所有题目本身可解
  challenges list                      列出包内题目库
`
}

export function usage(): void {
  console.log(usageText())
}

function libIds(): string[] {
  if (!existsSync(LIB_DIR)) return []
  return readdirSync(LIB_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

function parseArgs(argv: string[]): { id?: string; dir?: string } {
  let id: string | undefined
  let dir: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') {
      dir = argv[++i]
    } else if (!id) {
      id = argv[i]
    }
  }
  return { id, dir }
}

// ------------------------------------------------------------
// new — 下发题目模板
// ------------------------------------------------------------

export function cmdNew(id: string, dir?: string): { ok: boolean; message: string } {
  const src = path.join(LIB_DIR, id)
  if (!existsSync(src)) {
    return { ok: false, message: `题目不存在：${id}（challenges list 查看包内题目库）` }
  }
  const target = path.resolve(dir ?? './challenges', id)
  mkdirSync(target, { recursive: true })

  const template = path.join(src, 'template.tsx')
  const readme = path.join(src, 'README.md')
  if (existsSync(template)) {
    writeFileSync(path.join(target, 'solution.tsx'), readFileSync(template, 'utf8'))
  }
  if (existsSync(readme)) {
    writeFileSync(path.join(target, 'README.md'), readFileSync(readme, 'utf8'))
  }
  return {
    ok: true,
    message: `已下发题目 ${id}：
  ${path.join(target, 'solution.tsx')}
  ${path.join(target, 'README.md')}
完成实现后运行：challenges verify ${id}${dir ? ` --dir ${dir}` : ''}`,
  }
}

// ------------------------------------------------------------
// verify — 判题
// ------------------------------------------------------------

export async function cmdVerify(
  id: string,
  dir?: string,
): Promise<{ ok: boolean; output: string }> {
  const src = path.join(LIB_DIR, id)
  if (!existsSync(src)) {
    return { ok: false, output: `题目不存在：${id}（challenges list 查看包内题目库）` }
  }
  const userFile = path.resolve(dir ?? './challenges', id, 'solution.tsx')
  if (!existsSync(userFile)) {
    return {
      ok: false,
      output: `未找到你的实现：${userFile}\n先用 challenges new ${id}${dir ? ` --dir ${dir}` : ''} 下发题目`,
    }
  }

  // 1. DOM 环境（happy-dom）
  setupDom()

  // 2. 编译并执行用户 solution
  const userCode = compileTsx(readFileSync(userFile, 'utf8'), userFile)
  const solution = executeCompiled(userCode)

  // 3. 编译并执行包内 challenge（断言）
  const challengeFile = path.join(src, 'challenge.ts')
  const challengeCode = compileTsx(readFileSync(challengeFile, 'utf8'), challengeFile)
  const challengeModule = executeCompiled(challengeCode, { withChallenges: true })
  const challenge: Challenge = challengeModule.default as Challenge
  if (!challenge?.id) {
    return { ok: false, output: `[challenges] 题目定义损坏：${id}（缺少 default export）` }
  }

  // 4. 判题
  const result = await runChallenge(challenge, solution)
  return { ok: result.pass, output: formatResult(result) }
}

// ------------------------------------------------------------
// verify-all — 用参考实现自检
// ------------------------------------------------------------

export async function cmdVerifyAll(): Promise<{ ok: boolean; output: string }> {
  const ids = libIds()
  if (!ids.length) {
    return { ok: false, output: '（包内无题目）' }
  }
  const lines: string[] = []
  let failed = 0
  for (const id of ids) {
    const src = path.join(LIB_DIR, id)
    setupDom()
    const challengeCode = compileTsx(
      readFileSync(path.join(src, 'challenge.ts'), 'utf8'),
      path.join(src, 'challenge.ts'),
    )
    const challengeModule = executeCompiled(challengeCode, { withChallenges: true })
    const challenge = challengeModule.default as Challenge
    const refFile = path.join(src, 'solution.reference.tsx')
    if (!existsSync(refFile)) {
      lines.push(`  ⚠ ${id}: 缺少 solution.reference.tsx，跳过`)
      continue
    }
    const refCode = compileTsx(readFileSync(refFile, 'utf8'), refFile)
    const refSolution = executeCompiled(refCode)
    const result = await runChallenge(challenge, refSolution)
    if (result.pass) {
      lines.push(`  ✓ ${id}`)
    } else {
      failed++
      lines.push(`  ✗ ${id}: 参考实现未通过！断言或参考实现有误`)
      lines.push(
        formatResult(result)
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n'),
      )
    }
  }
  lines.push(failed ? `\n${failed} 题自检失败` : '\n全部题目自检通过')
  return { ok: failed === 0, output: lines.join('\n') }
}

// ------------------------------------------------------------
// list
// ------------------------------------------------------------

export function cmdList(): string {
  const ids = libIds()
  if (!ids.length) return '（包内无题目）'
  const lines = ['包内题目库：']
  for (const id of ids) {
    const readme = path.join(LIB_DIR, id, 'README.md')
    let title = ''
    if (existsSync(readme)) {
      const first = readFileSync(readme, 'utf8')
        .split('\n')
        .find((l) => l.startsWith('#'))
      title = first ? first.replace(/^#+\s*/, '') : ''
    }
    lines.push(`  ${id}${title ? ` — ${title}` : ''}`)
  }
  lines.push('\n取题：challenges new <id>')
  return lines.join('\n')
}

// ------------------------------------------------------------

/** 命令行主入口（发布后由 bin 调用） */
export async function main(argv = process.argv.slice(2)) {
  const [sub, ...restArgs] = argv
  const { id, dir } = parseArgs(restArgs)

  let ok = true
  let output: string
  switch (sub) {
    case 'new':
      if (!id) return usage()
      ;({ ok, message: output } = cmdNew(id, dir))
      break
    case 'verify':
      if (!id) return usage()
      ;({ ok, output } = await cmdVerify(id, dir))
      break
    case 'verify-all':
      ;({ ok, output } = await cmdVerifyAll())
      break
    case 'list':
      output = cmdList()
      break
    default:
      return usage()
  }
  console.log(output)
  if (!ok) process.exitCode = 1
}

// 直接执行（node dist/cli.js）时运行 main；被 import（测试）时不自动执行
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
