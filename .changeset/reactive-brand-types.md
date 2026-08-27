---
'@actview/core': minor
---

新增 `Reactive<T>` / `ShallowReactive<T>` 类型（reactive/shallowReactive 返回值品牌化）

- 此前两个工厂在类型层「隐形」（原样返回 T），无法表达「必须是响应式代理」的形参契约；现在返回值带运行时标记呼应的正向品牌：`T & { readonly '__v_isReactive'?: true }`。
- 结构透明零迁移成本：交叉类型 extends 语义保证返回值可直接当原始对象用（读属性/展开/toRefs 不变），原始对象赋给 `Reactive<T>` 形参也合法（可选品牌，非严格闸门）。
- 用法：`import { type Reactive } from 'actview'`; 硬闸门需求应改用 unique symbol 品牌 + toRaw 逃生口。
