declare global {
  /** Classic JSX transform target */
  function createElement(type: any, config?: any, ...children: any[]): any;

  /** JSX namespace for type-checking */
  namespace JSX {
    interface IntrinsicElements {
      [elem: string]: any;
    }
    type Element = any;
  }
}

export {};
