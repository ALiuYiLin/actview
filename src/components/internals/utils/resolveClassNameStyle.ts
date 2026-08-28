// ============================================================
// className / style 求值——移植自 @base-ui resolveClassName / resolveStyle
// 支持 string|object 与 (state)=>… 函数两种形态
// ============================================================

export function resolveClassName<State>(
  className: string | ((state: State) => string | undefined) | undefined,
  state: State,
) {
  return typeof className === 'function' ? className(state) : className;
}

export function resolveStyle<State>(
  style:
    | Record<string, any>
    | ((state: State) => Record<string, any> | undefined)
    | undefined,
  state: State,
) {
  return typeof style === 'function' ? style(state) : style;
}
