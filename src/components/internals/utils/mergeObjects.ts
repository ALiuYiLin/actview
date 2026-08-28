// ============================================================
// Base UI utils → ActView 移植（合并工具）
// 来源对照:E:\code3\base-ui\packages\utils\src\mergeObjects.ts
// ============================================================

/** 浅合并两个对象：单侧缺失直接返回另一侧；双侧都有生成新对象 */
export function mergeObjects<A extends object | undefined, B extends object | undefined>(
  a: A,
  b: B,
) {
  if (a && !b) {
    return a;
  }
  if (!a && b) {
    return b;
  }
  if (a || b) {
    return { ...a, ...b };
  }
  return undefined;
}
