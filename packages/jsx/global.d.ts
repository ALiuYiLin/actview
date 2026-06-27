/** Classic JSX transform target */
declare function createElement(type: any, config?: any, ...children: any[]): any;

/** JSX namespace for type-checking */
declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
  type Element = any;
}
