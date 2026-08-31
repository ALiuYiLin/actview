import type { File } from '@babel/core'
import type * as t from '@babel/types'

export type Slots = t.Identifier | t.ObjectExpression | null

export type State = {
  get: (name: string) => any
  set: (name: string, value: any) => any
  opts: VueJSXPluginOptions
  file: File
}

export interface VueJSXPluginOptions {
  /** enable optimization or not. */
  optimize?: boolean
  /** merge static and dynamic class / style attributes / onXXX handlers */
  mergeProps?: boolean
  /** configuring custom elements */
  isCustomElement?: (tag: string) => boolean
  /** enable object slots syntax */
  enableObjectSlots?: boolean
  /** Replace the function used when compiling JSX expressions */
  pragma?: string
  /**
   * React 函数组件语义：PascalCase 且含 JSX 的函数自动包 defineComponent
   * （function App() { return () => <JSX/> } 免手动包装）
   * @default true
   */
  autoDefineComponent?: boolean
  /**
   * 自动包装时 defineComponent 的 import 来源
   * @default 'actview'
   */
  defineComponentSource?: string
  /**
   * 产物 createVNode 的 import 来源（actview 导出包装函数：
   * props.children → 第三参，React 对齐；'vue' 为原生 createVNode）
   * @default 'actview'
   */
  createVNodeSource?: string
}
