// ============================================================
// @actview/devtools — 跨 window / extension 的安全序列化
// ============================================================

const MAX_DEPTH = 4
const MAX_KEYS = 50

export function serializeValue(
  value: unknown,
  depth = MAX_DEPTH,
  seen = new WeakSet<object>(),
): unknown {
  if (value == null) return value
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return value
  if (type === 'bigint') return `${value.toString()}n`
  if (type === 'symbol') return value.toString()
  if (type === 'function') {
    return `[Function ${(value as Function).name || 'anonymous'}]`
  }

  if (isHostNode(value)) {
    const node = value as Node
    const name = node.nodeName?.toLowerCase() || 'node'
    const text =
      node.nodeType === 3 ? ` ${(node as Text).data.slice(0, 80)}` : ''
    return `[DOM ${name}${text}]`
  }

  if (depth <= 0) {
    return Array.isArray(value) ? '[Array]' : '[Object]'
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS).map((item) =>
      serializeValue(item, depth - 1, seen),
    )
  }

  if (value instanceof Date) return value.toISOString()
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].slice(0, MAX_KEYS).map(([k, v]) => [
        String(k),
        serializeValue(v, depth - 1, seen),
      ]),
    )
  }
  if (value instanceof Set) {
    return [...value].slice(0, MAX_KEYS).map((item) =>
      serializeValue(item, depth - 1, seen),
    )
  }

  const result: Record<string, unknown> = {}
  let count = 0
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$')) continue
    if (count++ >= MAX_KEYS) {
      result['…'] = `[${Object.keys(value as object).length - MAX_KEYS} more]`
      break
    }
    try {
      result[key] = serializeValue(
        (value as Record<string, unknown>)[key],
        depth - 1,
        seen,
      )
    } catch {
      result[key] = '[getter error]'
    }
  }
  return result
}

export function serializeState(value: Record<string, unknown>): Record<string, unknown> {
  return serializeValue(value, MAX_DEPTH, new WeakSet()) as Record<
    string,
    unknown
  >
}

function isHostNode(value: unknown): boolean {
  return typeof Node !== 'undefined' && value instanceof Node
}
