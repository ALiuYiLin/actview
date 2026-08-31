// ============================================================
// actview v2 — JSX 类型层（全局增强）
//
//   TS 的 react-jsx 类型检查使用【全局 JSX 命名空间】
//   （jsxImportSource 只决定运行时 import，见 @types/react 同款机制）。
//   全局 JSX 已有：
//     - v1（@actview/jsx global.ts）：完整 IntrinsicElements + ElementType
//     - vue（@vue/runtime-core jsx.d.ts）：ElementAttributesProperty{ $props }
//       与 IntrinsicElements 索引（[elem: string]: any）
//   本文件只做 interface 合并扩展：
//     - IntrinsicAttributes 增加 Vue 指令属性（v-model/v-show/...）
//
//   组件 props 严格检查（React 语义）不在此处——由 actview 的
//   defineComponent 返回类型（带 call signature，TS 走函数组件路径）承担，
//   见 packages/actview/src/index.ts。
// ============================================================

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      // Vue 指令属性（编译期由 @actview/plugin-jsx 展开：
      // v-model → modelValue + onUpdate:modelValue；v-show 等保留）
      'v-model'?: any
      'v-show'?: any
      'v-html'?: any
      'v-text'?: any
      'v-slots'?: any
    }
  }
}

export {}
