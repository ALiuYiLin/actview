// ============================================================
// actview v2 — JSX 类型层（全局声明）
//
//   TS 的 react-jsx 类型检查使用【全局 JSX 命名空间】
//   （jsxImportSource 只决定运行时 import）。
//   vue 的 JSX 类型是 `declare module 'vue'` 内声明（非全局），
//   因此 v2 需要自己提供全局 JSX 表面：
//     - IntrinsicElements：完整 HTML/SVG 标签表（属性类型复用
//       @actview/jsx 的 React 语义类型：className/htmlFor/onChange）
//     - IntrinsicAttributes：key/ref + Vue 指令属性（v-model/v-show/...）
//   组件类型不在此声明——TS 默认 ElementType（string | 函数 | 构造器）
//   天然接受 vue 组件（defineComponent 产物是构造器类型）；
//   组件 props 严格检查由 actview 的 defineComponent 返回类型
//   （ActViewComponent：仅 call signature + $props）承担。
// ============================================================

import type {
  HTMLAttributes,
  SVGAttributes,
  AnchorHTMLAttributes,
  AreaHTMLAttributes,
  BlockquoteHTMLAttributes,
  ButtonHTMLAttributes,
  ColHTMLAttributes,
  DataHTMLAttributes,
  DelHTMLAttributes,
  DetailsHTMLAttributes,
  DialogHTMLAttributes,
  FormHTMLAttributes,
  HtmlHTMLAttributes,
  IframeHTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  InsHTMLAttributes,
  LabelHTMLAttributes,
  LiHTMLAttributes,
  LinkHTMLAttributes,
  MapHTMLAttributes,
  MediaHTMLAttributes,
  MenuHTMLAttributes,
  MetaHTMLAttributes,
  MeterHTMLAttributes,
  ObjectHTMLAttributes,
  OlHTMLAttributes,
  OptgroupHTMLAttributes,
  OptionHTMLAttributes,
  OutputHTMLAttributes,
  ParamHTMLAttributes,
  ProgressHTMLAttributes,
  QuoteHTMLAttributes,
  ScriptHTMLAttributes,
  SelectHTMLAttributes,
  SourceHTMLAttributes,
  StyleHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes,
  TimeHTMLAttributes,
  TrackHTMLAttributes,
} from './jsx-attributes'

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | null
      ref?: any
      /** 组件 children（React 语义；原生元素由具体标签类型约束） */
      children?: unknown
      // Vue 指令属性（编译期由 @actview/plugin-jsx 展开：
      // v-model → modelValue + onUpdate:modelValue；v-show 等保留）
      'v-model'?: any
      'v-show'?: any
      'v-html'?: any
      'v-text'?: any
      'v-slots'?: any
    }

    /** 组件 props 检查：构造器组件（vue DefineComponent）从实例 $props 取 */
    interface ElementAttributesProperty {
      $props: {}
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
      data: DataHTMLAttributes
      datalist: HTMLAttributes
      dd: HTMLAttributes
      details: DetailsHTMLAttributes
      dfn: HTMLAttributes
      dialog: DialogHTMLAttributes
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
      html: HtmlHTMLAttributes
      i: HTMLAttributes
      kbd: HTMLAttributes
      legend: HTMLAttributes
      li: LiHTMLAttributes
      main: HTMLAttributes
      map: MapHTMLAttributes
      mark: HTMLAttributes
      menu: MenuHTMLAttributes
      nav: HTMLAttributes
      noscript: HTMLAttributes
      object: ObjectHTMLAttributes
      optgroup: OptgroupHTMLAttributes
      output: OutputHTMLAttributes
      p: HTMLAttributes
      picture: HTMLAttributes
      pre: HTMLAttributes
      rp: HTMLAttributes
      rt: HTMLAttributes
      ruby: HTMLAttributes
      s: HTMLAttributes
      samp: HTMLAttributes
      script: ScriptHTMLAttributes
      search: HTMLAttributes
      section: HTMLAttributes
      slot: HTMLAttributes
      small: HTMLAttributes
      source: SourceHTMLAttributes
      span: HTMLAttributes
      strong: HTMLAttributes
      style: StyleHTMLAttributes
      sub: HTMLAttributes
      summary: HTMLAttributes
      sup: HTMLAttributes
      template: HTMLAttributes
      title: HTMLAttributes
      track: TrackHTMLAttributes
      u: HTMLAttributes
      ul: HTMLAttributes
      var: HTMLAttributes
      video: MediaHTMLAttributes
      wbr: HTMLAttributes

      // 动态组件占位标签 <component is={...}>（vue 语义）
      // （v1 的 HTMLAttributes 可能带 is?: string，先 Omit 掉）
      component: Omit<HTMLAttributes, 'is'> & { is?: any }

      // ---------- HTML 元素（专属属性） ----------
      a: AnchorHTMLAttributes
      area: AreaHTMLAttributes
      audio: MediaHTMLAttributes
      base: HTMLAttributes
      blockquote: BlockquoteHTMLAttributes
      button: ButtonHTMLAttributes
      col: ColHTMLAttributes
      colgroup: ColHTMLAttributes
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
      param: ParamHTMLAttributes
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
    }
  }
}

export {}
