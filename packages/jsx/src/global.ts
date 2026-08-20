// ============================================================
// JSX 全局类型增强 — 通过 tsconfig include 加载，全局生效
//   完整 IntrinsicElements（HTML + SVG）+ 组件 props 类型严格化
// ============================================================

import type {
  VNode,
  VNodeTypes,
  HTMLAttributes,
  SVGAttributes,
  AnchorHTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  OptionHTMLAttributes,
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  LabelHTMLAttributes,
  MediaHTMLAttributes,
  TableHTMLAttributes,
  MetaHTMLAttributes,
  LinkHTMLAttributes,
  IframeHTMLAttributes,
  AreaHTMLAttributes,
  OlHTMLAttributes,
  ProgressHTMLAttributes,
  MeterHTMLAttributes,
  TimeHTMLAttributes,
  DelHTMLAttributes,
  InsHTMLAttributes,
  BlockquoteHTMLAttributes,
  QuoteHTMLAttributes,
  ComponentType
} from './types.js'

declare global {
  namespace JSX {
    type Element = VNode
    /** 组件对象（defineComponent 产物 { __setup }）也可作为 JSX 元素 */
    type ElementType = VNodeTypes | ComponentType
    type ArrayElement = VNode[]
    type Child = VNode | string | number | boolean | null | undefined
    type Children = Child | Child[]

    /** 所有 JSX 元素（DOM + 组件）都接受的内部属性 */
    interface IntrinsicAttributes {
      key?: string | number | null
      ref?: any
    }

    interface IntrinsicElements {
      // ---------- HTML 元素（通用） ----------
      abbr: HTMLAttributes
      address: HTMLAttributes
      article: HTMLAttributes
      aside: HTMLAttributes
      b: HTMLAttributes
      bdi: HTMLAttributes
      bdo: HTMLAttributes
      body: HTMLAttributes
      br: HTMLAttributes
      canvas: HTMLAttributes
      caption: HTMLAttributes
      cite: HTMLAttributes
      code: HTMLAttributes
      data: HTMLAttributes
      datalist: HTMLAttributes
      dd: HTMLAttributes
      details: HTMLAttributes
      dfn: HTMLAttributes
      dialog: HTMLAttributes
      div: HTMLAttributes
      dl: HTMLAttributes
      dt: HTMLAttributes
      em: HTMLAttributes
      embed: HTMLAttributes
      fieldset: HTMLAttributes
      figcaption: HTMLAttributes
      figure: HTMLAttributes
      footer: HTMLAttributes
      h1: HTMLAttributes
      h2: HTMLAttributes
      h3: HTMLAttributes
      h4: HTMLAttributes
      h5: HTMLAttributes
      h6: HTMLAttributes
      head: HTMLAttributes
      header: HTMLAttributes
      hgroup: HTMLAttributes
      hr: HTMLAttributes
      html: HTMLAttributes
      i: HTMLAttributes
      kbd: HTMLAttributes
      legend: HTMLAttributes
      li: HTMLAttributes
      main: HTMLAttributes
      map: HTMLAttributes
      mark: HTMLAttributes
      menu: HTMLAttributes
      nav: HTMLAttributes
      noscript: HTMLAttributes
      object: HTMLAttributes
      optgroup: HTMLAttributes
      output: HTMLAttributes
      p: HTMLAttributes
      picture: HTMLAttributes
      pre: HTMLAttributes
      rp: HTMLAttributes
      rt: HTMLAttributes
      ruby: HTMLAttributes
      s: HTMLAttributes
      samp: HTMLAttributes
      script: HTMLAttributes
      search: HTMLAttributes
      section: HTMLAttributes
      slot: HTMLAttributes
      small: HTMLAttributes
      source: HTMLAttributes
      span: HTMLAttributes
      strong: HTMLAttributes
      style: HTMLAttributes
      sub: HTMLAttributes
      summary: HTMLAttributes
      sup: HTMLAttributes
      template: HTMLAttributes
      title: HTMLAttributes
      track: HTMLAttributes
      u: HTMLAttributes
      ul: HTMLAttributes
      var: HTMLAttributes
      video: MediaHTMLAttributes
      wbr: HTMLAttributes

      // 动态组件占位标签 <component is={...}>
      component: HTMLAttributes & { is?: any }

      // ---------- HTML 元素（专属属性） ----------
      a: AnchorHTMLAttributes
      area: AreaHTMLAttributes
      audio: MediaHTMLAttributes
      base: HTMLAttributes
      blockquote: BlockquoteHTMLAttributes
      button: ButtonHTMLAttributes
      col: TableHTMLAttributes
      colgroup: TableHTMLAttributes
      del: DelHTMLAttributes
      form: FormHTMLAttributes
      iframe: IframeHTMLAttributes
      img: ImgHTMLAttributes
      input: InputHTMLAttributes
      ins: InsHTMLAttributes
      label: LabelHTMLAttributes
      link: LinkHTMLAttributes
      meta: MetaHTMLAttributes
      meter: MeterHTMLAttributes
      ol: OlHTMLAttributes
      option: OptionHTMLAttributes
      progress: ProgressHTMLAttributes
      q: QuoteHTMLAttributes
      select: SelectHTMLAttributes
      table: TableHTMLAttributes
      tbody: TableHTMLAttributes
      td: TableHTMLAttributes
      textarea: TextareaHTMLAttributes
      tfoot: TableHTMLAttributes
      th: TableHTMLAttributes
      thead: TableHTMLAttributes
      time: TimeHTMLAttributes
      tr: TableHTMLAttributes

      // ---------- SVG 元素 ----------
      svg: SVGAttributes
      animate: SVGAttributes
      animateMotion: SVGAttributes
      animateTransform: SVGAttributes
      circle: SVGAttributes
      clipPath: SVGAttributes
      defs: SVGAttributes
      desc: SVGAttributes
      ellipse: SVGAttributes
      feBlend: SVGAttributes
      feColorMatrix: SVGAttributes
      feComponentTransfer: SVGAttributes
      feComposite: SVGAttributes
      feConvolveMatrix: SVGAttributes
      feDiffuseLighting: SVGAttributes
      feDisplacementMap: SVGAttributes
      feDistantLight: SVGAttributes
      feDropShadow: SVGAttributes
      feFlood: SVGAttributes
      feFuncA: SVGAttributes
      feFuncB: SVGAttributes
      feFuncG: SVGAttributes
      feFuncR: SVGAttributes
      feGaussianBlur: SVGAttributes
      feImage: SVGAttributes
      feMerge: SVGAttributes
      feMergeNode: SVGAttributes
      feMorphology: SVGAttributes
      feOffset: SVGAttributes
      fePointLight: SVGAttributes
      feSpecularLighting: SVGAttributes
      feSpotLight: SVGAttributes
      feTile: SVGAttributes
      feTurbulence: SVGAttributes
      filter: SVGAttributes
      foreignObject: SVGAttributes
      g: SVGAttributes
      image: SVGAttributes
      line: SVGAttributes
      linearGradient: SVGAttributes
      marker: SVGAttributes
      mask: SVGAttributes
      metadata: SVGAttributes
      mpath: SVGAttributes
      path: SVGAttributes
      pattern: SVGAttributes
      polygon: SVGAttributes
      polyline: SVGAttributes
      radialGradient: SVGAttributes
      rect: SVGAttributes
      set: SVGAttributes
      stop: SVGAttributes
      symbol: SVGAttributes
      switch: SVGAttributes
      text: SVGAttributes
      textPath: SVGAttributes
      tspan: SVGAttributes
      use: SVGAttributes
      view: SVGAttributes

      /** 未知标签兜底：按 HTML 属性处理 */
      [tag: string]: HTMLAttributes
    }

    interface ElementChildrenAttribute {
      children: unknown
    }

    /**
     * 组件元素 props 检查：声明类型 + HTML 通用属性。
     * 声明内属性（如 { name: string }）做必填/类型检查；
     * 额外仅允许 HTML 属性（class/style/id/title/on* / data-* / aria-* 等），
     * 任意自定义属性会报错（对齐 React 严格语义）。
     *
     * 用 `Omit<HTMLAttributes, keyof P>` 而非 `P & HTMLAttributes` 全量交集：
     * 组件已声明的键（如 className: string | ((state) => ...)）不再与
     * HTMLAttributes 同名键交集——否则 `(string | fn) & (string | undefined)`
     * 会展开出不可满足的 `fn & string` 成员，函数形态的 className/style
     * 永远无法通过 JSX 类型检查。组件自身声明的类型优先，未声明的键
     * 仍从 HTMLAttributes 放行。
     */
    type LibraryManagedAttributes<C, P> = P & Omit<HTMLAttributes, keyof P>
  }
}

export {}
