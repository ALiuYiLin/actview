// ============================================================
// DevTools panel 展示辅助
// ============================================================

export function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
