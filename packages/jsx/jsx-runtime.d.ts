/** Runtime function signatures */
export function jsx(type: any, config: any, maybeKey?: any): any;
export function jsxs(type: any, config: any, maybeKey?: any): any;
export const Fragment: symbol;

/** JSX intrinsic elements — all HTML tags produce `any` */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elem: string]: any;
    }
    type Element = any;
  }
}
