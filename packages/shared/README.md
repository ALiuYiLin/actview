# @actview/shared

`@actview` 内部包共用的工具函数与类型。**派生自 [`@vue/shared`](https://github.com/vuejs/core/tree/main/packages/shared) 3.5.39**（MIT，版权与许可见 [LICENSE](./LICENSE)）。

目前只包含响应式模块实际依赖的部分：

- `general.ts` —— `isObject` / `isArray` / `hasOwn` / `def` / `hasChanged` / `isIntegerKey` / `toRawType` 等运行时判断与工具；
- `makeMap.ts` —— `makeMap`；
- `typeUtils.ts` —— `IfAny` / `Prettify` / `UnionToIntersection` 等类型工具。

后续按各包需要从 Vue 上游裁剪补入（优先保持与上游同文件结构，便于升级对照）。

## 构建期约定

`general.ts` 使用 Vue 的编译期常量 `__DEV__`（声明见 `packages/global.d.ts`）：

- 本包构建（tsup）：`banner` 注入 `const __DEV__ = process.env.NODE_ENV !== "production"`；
- 直接消费源码（workspace dev）：宿主需 `define: { __DEV__: 'true' }`。
