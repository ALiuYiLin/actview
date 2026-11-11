// 自定义断言：toHaveBeenWarned / toHaveBeenWarnedLast / toHaveBeenWarnedTimes
// 移植自 Vue 3.5.39 scripts/setup-vitest.ts（MIT）
import type { MockInstance } from 'vitest'

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

interface CustomMatchers<R = unknown> {
  toHaveBeenWarned(): R
  toHaveBeenWarnedLast(): R
  toHaveBeenWarnedTimes(n: number): R
}

let warn: MockInstance
const asserted: Set<string> = new Set()

expect.extend({
  toHaveBeenWarned(received: string) {
    const passed = warn.mock.calls.some(args => args[0].includes(received))
    if (passed) {
      asserted.add(received)
      return { pass: true, message: () => `expected "${received}" not to have been warned.` }
    }
    const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
    return {
      pass: false,
      message: () =>
        `expected "${received}" to have been warned` +
        (msgs.length ? `.

Actual messages:

 - ${msgs}` : ' but no warning was recorded.'),
    }
  },

  toHaveBeenWarnedLast(received: string) {
    const passed = warn.mock.calls[warn.mock.calls.length - 1][0].includes(received)
    if (passed) {
      asserted.add(received)
      return { pass: true, message: () => `expected "${received}" not to have been warned last.` }
    }
    const msgs = warn.mock.calls.map(args => args[0]).join('\n - ')
    return {
      pass: false,
      message: () => `expected "${received}" to have been warned last.

Actual messages:

 - ${msgs}`,
    }
  },

  toHaveBeenWarnedTimes(received: string, n: number) {
    let found = 0
    warn.mock.calls.forEach(args => {
      if (args[0].includes(received)) found++
    })
    if (found === n) {
      asserted.add(received)
      return { pass: true, message: () => `expected "${received}" to have been warned ${n} times.` }
    }
    return {
      pass: false,
      message: () => `expected "${received}" to have been warned ${n} times but got ${found}.`,
    }
  },
})

beforeEach(() => {
  asserted.clear()
  warn = vi.spyOn(console, 'warn')
  warn.mockImplementation(() => {})
})

afterEach(() => {
  const assertedArray = Array.from(asserted)
  const nonAssertedWarnings = warn.mock.calls
    .map(args => args[0])
    .filter(received => !assertedArray.some(assertedMsg => received.includes(assertedMsg)))
  warn.mockRestore()
  if (nonAssertedWarnings.length) {
    throw new Error(`test case threw unexpected warnings:
 - ${nonAssertedWarnings.join('\n - ')}`)
  }
})
