// ============================================================
// 全局 JSX 命名空间（公开作者层 / authoring）
//
// 只放「写 TSX 时编辑器提示与类型检查」需要的内容：
//   - JSX.Element → runtime-core 的公开 Element 契约（不含 VNode 内部字段）
//   - JSX.ElementType → 原生标签 / Fragment / 源码组件函数 / 编译产物 tag 视图
//   - JSX.IntrinsicElements → 各标签属性类型（来自 ./jsx/attrs）
//   - JSX.LibraryManagedAttributes → props 的 Ref 解包形态 + HTML 通用属性放行
//
// 渲染器内部类型不进入本命名空间（VNode 只在 runtime-core/internal）。
// 该文件只有类型声明（编译后为空模块），由 jsx-runtime / 包入口副作用引入。
// ============================================================

import type {
  Element as RuntimeElement,
  ElementType as RuntimeElementType,
} from '@actview/runtime-core'

import type {
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
  DialogHTMLAttributes,
  DetailsHTMLAttributes,
  ScriptHTMLAttributes,
  ObjectHTMLAttributes,
  ColHTMLAttributes,
  TrackHTMLAttributes,
  SourceHTMLAttributes,
  StyleHTMLAttributes,
  HtmlHTMLAttributes,
  DataHTMLAttributes,
  LiHTMLAttributes,
  OptgroupHTMLAttributes,
  OutputHTMLAttributes,
  ParamHTMLAttributes,
  MapHTMLAttributes,
  MenuHTMLAttributes,
  MaybeRefProps,
  MaybeRefAttrs,
} from './jsx/attrs'

declare global {
  namespace JSX {
    /** 公开元素契约：JSX 表达式 / render 返回值的静态类型 */
    type Element = RuntimeElement
    /** 可作为 JSX 标签的类型（原生标签 / Fragment / 源码组件 / 编译产物 tag 视图） */
    type ElementType = RuntimeElementType
    /** 元素数组（JSX 表达式集合） */
    type ArrayElement = Element[]
    type Child = Element | string | number | boolean | null | undefined
    type Children = Child | Child[]

    /** 所有 JSX 元素（DOM + 组件）都接受的内部属性 */
    interface IntrinsicAttributes {
      key?: string | number | null
      ref?: any
    }
    interface IntrinsicElementsBase {
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

      // 动态组件占位标签 <component is={...}>
      component: HTMLAttributes & { is?: any }

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

      /** 未知标签兜底：按 HTML 属性处理 */
      [tag: string]: HTMLAttributes
    }

    /**
     * IntrinsicElements 的元素属性统一 MaybeRef 化：
     * TS 对 intrinsic 元素（<input value={ref} />）的 props 检查直接读
     * JSX.IntrinsicElements[K]，不经 jsx 函数签名——因此元素属性类型本身
     * 必须接受 Ref（运行时由 JSX runtime 顶层解包）。
     */
    type MaybeRefIntrinsic<T extends Record<string, any>> = {
      [K in keyof T]: MaybeRefAttrs<T[K]>
    }

    interface IntrinsicElements extends MaybeRefIntrinsic<IntrinsicElementsBase> {}

    interface ElementChildrenAttribute {
      children: unknown
    }

    /**
     * 组件元素 props 检查：声明类型（Ref 化）+ HTML 通用属性放行。
     * 组件已声明的键不再与 HTMLAttributes 同名键交集（函数形态 className /
     * style 保持可用）；未声明的键仍从 HTMLAttributes 放行（class / style /
     * id / 事件 / data-* / aria-* 等），任意自定义属性会报错。
     */
    type LibraryManagedAttributes<C, P> = MaybeRefProps<P> &
      Omit<HTMLAttributes, keyof P>
  }
}

export {}