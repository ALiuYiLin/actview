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
}
