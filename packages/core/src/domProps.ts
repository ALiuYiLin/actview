// ============================================================
// DOM props patch — 属性 / class / style / 事件（docs/renderer-design.md §7.3）
//
//   M1 最小集：
//   - 跳过 children / key / ref（children 由 renderer 的 children diff 处理，
//     key 只参与 VNode 比对，ref 交给 refs.setRef）
//   - onXxx（第三字符大写）→ removeEventListener(prev) + addEventListener(next)
//   - class → setAttribute('class', String(next))
//   - style：字符串 → cssText；对象 → 逐项写（移除旧对象里多余的 key）
//   - boolean true → setAttribute(key, '')；false / null / undefined → removeAttribute
//   - 其它：key 在 el 上（如 value / checked / disabled）→ 写 DOM property；
//     否则 setAttribute
// ============================================================

/** 不参与 DOM patch 的 props key（由别处处理） */
const SKIP_KEYS = new Set(['children', 'key', 'ref'])

/** onXxx：'on' + 大写字母（第三字符），避免把 once / only 之类误判为事件 */
function isEventKey(key: string): boolean {
  return key.length > 2 && key[0] === 'o' && key[1] === 'n' && key[2] >= 'A' && key[2] <= 'Z'
}

/**
 * 写入单个 prop。
 * prev === next 时跳过（更新路径避免无意义 DOM 操作）。
 */
export function patchProp(
  el: Element,
  key: string,
  prev: unknown,
  next: unknown,
): void {
  if (SKIP_KEYS.has(key)) return
  if (prev === next) return

  if (isEventKey(key)) {
    patchEvent(el, key, prev, next)
    return
  }

  if (key === 'class') {
    if (next == null) {
      el.removeAttribute('class')
    } else {
      el.setAttribute('class', String(next))
    }
    return
  }

  if (key === 'style') {
    patchStyle(el, prev, next)
    return
  }

  // 布尔属性：true → 空属性值；false / null / undefined → 移除
  if (next === true) {
    el.setAttribute(key, '')
    return
  }
  if (next === false || next == null) {
    el.removeAttribute(key)
    return
  }

  // DOM property 特例（value / checked / disabled 等）
  if (key in el && key !== 'style' && key !== 'class') {
    ;(el as any)[key] = next
    return
  }

  el.setAttribute(key, String(next))
}

/** 事件：onClick → click；换 handler 时先移除旧监听再挂新监听 */
function patchEvent(
  el: Element,
  key: string,
  prev: unknown,
  next: unknown,
): void {
  const name = key.slice(2).toLowerCase()
  if (typeof prev === 'function') {
    el.removeEventListener(name, prev as EventListener)
  }
  if (typeof next === 'function') {
    el.addEventListener(name, next as EventListener)
  }
}

/** style：字符串直接覆盖 cssText；对象逐项写并清理旧对象里多余的 key */
function patchStyle(el: Element, prev: unknown, next: unknown): void {
  const style = (el as HTMLElement).style
  if (!style) return

  if (next == null) {
    style.cssText = ''
    return
  }

  if (typeof next === 'string') {
    style.cssText = next
    return
  }

  if (typeof next === 'object') {
    if (prev && typeof prev === 'object') {
      // 移除旧对象里新对象没有的 key（如 { color } → { fontSize } 时清掉 color）
      for (const key in prev as Record<string, unknown>) {
        if (!(key in (next as Record<string, unknown>))) {
          removeStyle(style, key)
        }
      }
    } else {
      // 旧值是字符串 / null：先清空，避免字符串残留样式叠加
      style.cssText = ''
    }
    for (const key in next as Record<string, unknown>) {
      setStyle(style, key, (next as Record<string, unknown>)[key])
    }
    return
  }

  // 其它类型按字符串 cssText 处理
  style.cssText = String(next)
}

function setStyle(
  style: CSSStyleDeclaration,
  key: string,
  value: unknown,
): void {
  if (value == null || value === '') {
    removeStyle(style, key)
    return
  }
  // CSS 变量（--x）与 kebab-case（background-color）走 setProperty
  if (key.includes('-')) {
    style.setProperty(key, String(value))
  } else {
    ;(style as any)[key] = value
  }
}

function removeStyle(style: CSSStyleDeclaration, key: string): void {
  if (key.includes('-')) {
    style.removeProperty(key)
  } else {
    ;(style as any)[key] = ''
  }
}

/** 批量 patch：先写 next 的 key，再移除 prev 里已不存在的 key */
export function patchProps(
  el: Element,
  prevProps: Record<string, any> | null,
  nextProps: Record<string, any> | null,
): void {
  const prev = prevProps || {}
  const next = nextProps || {}

  for (const key in next) {
    patchProp(el, key, prev[key], next[key])
  }

  for (const key in prev) {
    if (!(key in next)) {
      patchProp(el, key, prev[key], null)
    }
  }
}
