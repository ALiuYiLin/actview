// ============================================================
// @local/jsx-factory — JSX 全局类型增强
// 通过 declare global 注入 JSX 命名空间，
// 让 TypeScript 对所有 .tsx 中的 JSX 元素提供 onXxx 代码提示。
// ============================================================
// 此文件通过 tsconfig include 加载，全局生效。
// ============================================================

import type { VNode, VNodeTypes, HtmlProps, InputProps, LazyVNode } from './types.js';

declare global {
  namespace JSX {
    type Element = VNode;
    type ElementType = VNodeTypes;
    type ArrayElement = VNode[];
    type Child = VNode | string | number | boolean | null | undefined;
    type Children = Child | Child[];

    interface IntrinsicElements {
      div: HtmlProps;
      span: HtmlProps;
      p: HtmlProps;
      h1: HtmlProps;
      h2: HtmlProps;
      h3: HtmlProps;
      h4: HtmlProps;
      h5: HtmlProps;
      h6: HtmlProps;
      a: HtmlProps;
      button: HtmlProps;
      form: HtmlProps;
      label: HtmlProps;
      ul: HtmlProps;
      ol: HtmlProps;
      li: HtmlProps;
      table: HtmlProps;
      thead: HtmlProps;
      tbody: HtmlProps;
      tr: HtmlProps;
      td: HtmlProps;
      th: HtmlProps;
      strong: HtmlProps;
      em: HtmlProps;
      b: HtmlProps;
      i: HtmlProps;
      u: HtmlProps;
      small: HtmlProps;
      code: HtmlProps;
      pre: HtmlProps;
      blockquote: HtmlProps;
      section: HtmlProps;
      article: HtmlProps;
      nav: HtmlProps;
      header: HtmlProps;
      footer: HtmlProps;
      main: HtmlProps;
      aside: HtmlProps;
      figure: HtmlProps;
      figcaption: HtmlProps;
      img: HtmlProps;
      svg: HtmlProps;
      video: HtmlProps;
      audio: HtmlProps;
      canvas: HtmlProps;
      iframe: HtmlProps;
      br: HtmlProps;
      hr: HtmlProps;
      style: HtmlProps;
      link: HtmlProps;
      meta: HtmlProps;
      slot: HtmlProps;
      details: HtmlProps;
      summary: HtmlProps;
      dialog: HtmlProps;
      menu: HtmlProps;
      progress: HtmlProps;
      time: HtmlProps;
      mark: HtmlProps;
      del: HtmlProps;
      ins: HtmlProps;
      sub: HtmlProps;
      sup: HtmlProps;
      textarea: HtmlProps;
      select: HtmlProps;
      input: InputProps;
      [tag: string]: HtmlProps;
    }

    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export {};
