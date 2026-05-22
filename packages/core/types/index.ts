export type Ref<T> = {
  value: T;
  __isRef: true;
};

export type ParsedOption = {
  el: Element;
  props: Record<string, any>;
  render: (props: Record<string, any>) => string | HTMLElement | Text | DocumentFragment | SVGElement;
};

export type RenderFn = (props: Record<string, any>) => HTMLElement | DocumentFragment | Text | string | SVGElement;
