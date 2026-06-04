# 补充 VNodeTypes 类型修复 JSX Element 类型报错

## 问题

`packages/jsx/src/jsx-global.ts:20`

```
找不到名称 "VNodeTypes"
```

用户在 JSX 命名空间中添加了 `ElementType`、`ArrayElement`、`Child`、`Children` 类型定义，其中引用了 `VNodeTypes` 但未定义。

## 根因

`VNodeTypes` 未被导出，`jsx-global.ts` 无法引用。

## 修复

### `packages/jsx/src/types.ts` — 新增 VNodeTypes 类型

```typescript
/** VNode 的 type 字段允许的类型：HTML 标签名、组件函数、Fragment */
export type VNodeTypes = string | Component | typeof Fragment
```

对应 VNode 的 Type 泛型参数默认值：

```typescript
export interface VNode<
  Props = Record<string, unknown>,
  Type = string | Component<any> | typeof Fragment,  // ← 与此一致
>
```

### `packages/jsx/src/jsx-global.ts` — 导入并使用

```diff
- import { VNode } from './types';
+ import { VNode, VNodeTypes } from './types';
```

## JSX 命名空间中的类型定义

`jsx-global.ts` 中定义的 JSX 相关类型：

| 类型 | 定义 | 用途 |
|------|------|------|
| `Element` | `VNode` | JSX 表达式类型 |
| `ElementType` | `VNodeTypes` | JSX 元素 type 的允许类型 |
| `ArrayElement` | `VNode[]` | JSX 子节点数组类型 |
| `Child` | `VNode \| string \| number \| boolean \| null \| undefined` | 单个子节点 |
| `Children` | `Child \| Child[]` | 子节点（单个或数组） |

## 文件变更

| 文件 | 变更 |
|------|------|
| `packages/jsx/src/types.ts` | 新增 `VNodeTypes` 类型导出 |
| `packages/jsx/src/jsx-global.ts` | 导入 `VNodeTypes` |
