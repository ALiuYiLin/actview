// ============================================================
// challenges CLI — 集成测试（取题/做题/交验闭环）
//   题目库在包内，CLI 自包含编译执行（happy-dom + 注入运行时）
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  cmdNew,
  cmdVerify,
  cmdVerifyAll,
  cmdList,
} from '@actview/challenges'

let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'actview-challenge-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('challenges CLI（题目库在包内，用户只做取题/做题/交验）', () => {
  it('list：列出包内题目库', () => {
    const out = cmdList()
    expect(out).toContain('reactivity-ref')
    expect(out).toContain('component-jsx')
  })

  it('new：下发模板到指定目录（--dir）', () => {
    const r = cmdNew('reactivity-ref', workDir)
    expect(r.ok).toBe(true)

    const solFile = path.join(workDir, 'reactivity-ref', 'solution.tsx')
    const readmeFile = path.join(workDir, 'reactivity-ref', 'README.md')
    expect(existsSync(solFile)).toBe(true)
    expect(existsSync(readmeFile)).toBe(true)
    // 模板包含 TODO 占位
    expect(readFileSync(solFile, 'utf8')).toContain('TODO')
  })

  it('new：默认下发到 ./challenges/<id>/', () => {
    // 用 workDir 模拟 cwd（cmdNew 的 dir 参数为空时用 './challenges'）
    const r = cmdNew('reactivity-computed', path.join(workDir, 'challenges'))
    expect(r.ok).toBe(true)
    expect(
      existsSync(path.join(workDir, 'challenges', 'reactivity-computed', 'solution.tsx')),
    ).toBe(true)
  })

  it('new：不存在的题目报错', () => {
    const r = cmdNew('no-such-challenge', workDir)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('题目不存在')
  })

  it('verify：TODO 未实现 → FAIL 且给出报错信息', async () => {
    cmdNew('reactivity-ref', workDir)
    const r = await cmdVerify('reactivity-ref', workDir)
    expect(r.ok).toBe(false)
    expect(r.output).toContain('❌')
  })

  it('verify：正确实现 → PASS', async () => {
    cmdNew('reactivity-ref', workDir)
    writeFileSync(
      path.join(workDir, 'reactivity-ref', 'solution.tsx'),
      `import { ref } from 'actview'
export function useCounter(initial) {
  const count = ref(initial)
  const increment = () => { count.value++ }
  return { count, increment }
}`,
    )
    const r = await cmdVerify('reactivity-ref', workDir)
    expect(r.ok).toBe(true)
    expect(r.output).toContain('✅')
  })

  it('verify：错误实现 → FAIL + 框架语义提示（props 响应性考点）', async () => {
    cmdNew('props-use-prop', workDir)
    // 错误写法：setup 直接解构 props（快照，丢失响应性）
    writeFileSync(
      path.join(workDir, 'props-use-prop', 'solution.tsx'),
      `import { useProps } from 'actview'
export function Counter(props) {
  const { count } = props
  return <p data-testid="count">count: {count ?? 0}</p>
}`,
    )
    const r = await cmdVerify('props-use-prop', workDir)
    expect(r.ok).toBe(false)
    // 第一次渲染对，props 更新后不同步 → 断言失败
    expect(r.output).toContain('props 更新后视图同步')
    expect(r.output).toContain('不要')
  })

  it('verify：未下发题目时提示先 new', async () => {
    const r = await cmdVerify('reactivity-ref', workDir)
    expect(r.ok).toBe(false)
    expect(r.output).toContain('未找到你的实现')
  })

  it('verify-all：全部题目用参考实现自检通过（题目本身可解）', async () => {
    const r = await cmdVerifyAll()
    expect(r.ok).toBe(true)
    expect(r.output).toContain('全部题目自检通过')
  })
})
