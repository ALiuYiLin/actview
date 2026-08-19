// ============================================================
// 断言工具 — 每条断言记录到 checks（失败不抛，收集全部失败点）
// ============================================================

import type { AssertApi, CheckResult } from './types'

/** 深度遍历子树元素（不含根自身）收集 textContent */
function collectTexts(root: Element): string[] {
  const out: string[] = []
  const visit = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child.textContent) out.push(child.textContent)
      visit(child)
    }
  }
  visit(root)
  return out
}

/** 值比较：数组逐项 Object.is，其余 Object.is */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  }
  return Object.is(a, b)
}

export function createAssert(checks: CheckResult[]): AssertApi {
  const record = (check: CheckResult) => checks.push(check)

  return {
    text(name, el, expected, hint) {
      const texts = el ? collectTexts(el) : []
      const actual = el ? (el.textContent ?? '') : ''
      record({
        name,
        pass: el != null && actual.includes(expected),
        message: `期望文本包含 "${expected}"，实际为 "${actual}"`,
        hint
      })
      void texts
    },
    class(name, el, cls, hint) {
      const has = el != null && el.classList.contains(cls)
      record({
        name,
        pass: has,
        message: `期望元素包含 class "${cls}"${el ? `，实际 classList 为 "${el.className}"` : '（元素不存在）'}`,
        hint
      })
    },
    testId(name, el, id, expectedText, hint) {
      const elFound = el?.querySelector(`[data-testid="${id}"]`) ?? null
      const textOk = expectedText == null || (elFound?.textContent ?? '').includes(expectedText)
      record({
        name,
        pass: elFound != null && textOk,
        message: expectedText
          ? `期望找到 data-testid="${id}" 且文本包含 "${expectedText}"，实际${elFound ? `文本为 "${elFound.textContent}"` : '未找到'}`
          : `期望找到 data-testid="${id}"，实际${elFound ? '已找到' : '未找到'}`,
        hint
      })
    },
    truthy(name, value, hint) {
      record({
        name,
        pass: !!value,
        message: `期望为真，实际为 ${String(value)}`,
        hint
      })
    },
    equal(name, actual, expected, hint) {
      const pass = sameValue(actual, expected)
      record({
        name,
        pass,
        message: `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`,
        hint
      })
    },
    count(name, el, n, hint) {
      const actual = el ? Array.from(el.children).length : 0
      record({
        name,
        pass: actual === n,
        message: `期望子元素数量 ${n}，实际 ${actual}`,
        hint
      })
    }
  }
}
