// ============================================================
// AvatarRoot —— 移植自 base-ui avatar/root/AvatarRoot.tsx（ActView 惯用法版）
//
// React 原版结构:
//   React.forwardRef(function AvatarRoot(componentProps, forwardedRef) {
//     const { className, render, style, ...elementProps } = componentProps
//     const [imageLoadingStatus, setImageLoadingStatus] = useState('idle')
//     const contextValue = useMemo(() => ({...}), [...])
//     const element = useRenderElement('span', componentProps, {...})
//     return <AvatarRootContext.Provider value={contextValue}>{element}</…>
//   })
//
// ActView 转换要点（⚠️ 不要照抄 React 的快照解构）:
//   1. ⚠️ PD-15:props 是 shallowReactive——setup 期解构得到的是快照值
//      （且 setup 窗口 pauseTracking,连追踪都会被吞）。用 toRefs 把每个
//      prop 转成活引用,渲染期 .value 读取保持追踪与实时性。
//   2. React.forwardRef → props.ref（React19 形态）,经 toRefs 拿活引用,
//      useRenderElement 内部 useMergedRefs 覆盖为真实 DOM。
//   3. useState → ref;useMemo contextValue → createContext.Provider JSX 包裹
//      （ActView 的 createContext 与 React 心智一一对应,内部由 provide/injects
//       机制实现——ctx.Provider 的 setup 期 provide,后代经 injects 链继承）。
//      Ref 本体进 context（引用稳定 = memo 等价）。
//   4. 派生数据（state/elementProps）用 computed:渲染期 .value 读取归渲染
//      effect 追踪;依赖未变走缓存（引用稳定）,变化置脏重算并主动 trigger
//      渲染 effect（惰性 computed 也能驱动重渲染）。
//   5. 返回 <AvatarRootContext.Provider> 包 <>{useRenderElement(...)}</>:
//      字面 Fragment 是 babel 简写组件的 JSX 锚,helper 调用保持逐渲染求值
//      （新编译契约）。
// ============================================================

import { computed, reactive, toRefs, type Ref } from 'actview'
import { useRenderElement } from '../../internals/useRenderElement'
import { AvatarRootContext } from './AvatarRootContext'
import { avatarStateAttributesMapping } from './stateAttributesMapping'
import type { BaseUIComponentProps } from '../../internals/types'

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface AvatarRootState {
  /** 头像图片加载状态 */
  imageLoadingStatus: ImageLoadingStatus
}

export interface AvatarRootProps
  extends BaseUIComponentProps<'span', AvatarRootState> {}

export function AvatarRoot(props: AvatarRootProps) {
  // toRefs:每个 prop 转为活引用（ObjectRefImpl 读 props[key]）,
  // 渲染期 .value 求值 → 保持追踪与实时性（对齐 Vue toRefs 语义）。
  // ⚠️ ref 必须从 toRefs 中排除、直读 props.ref——props.ref 的【值本身就是
  // 一个 ref 对象】（父传入的根 DOM 引用）,经 toRefs 再 .value 会双重解包
  // 变成「实例/DOM 当前值」而非 ref 本体。
  // rest 显式标注 Record<string, Ref>（toRefs 的映射类型对 rest 展开后
  // 无索引签名,string 下标会报 TS2536）
  const { className, render, style, ...elementRefs } = toRefs(props) as Record<
    string,
    Ref<any>
  >

  // React: useState('idle') → ActView: 状态直接放进 context 的 reactive 载体
  // （原始值字段:读走 get 陷阱 track、写走 set 陷阱 trigger）。
  // setImageLoadingStatus = 统一写入口（软约束）:方法内引用 contextValue 自身
  // → 写代理属性触发 set 陷阱;⚠️ const 必须显式标注类型,否则闭包内自引用
  // 会触发 TS 循环推断错误。
  const contextValue: AvatarRootContext = reactive<AvatarRootContext>({
    imageLoadingStatus: 'idle',
    setImageLoadingStatus(status: ImageLoadingStatus) {
      contextValue.imageLoadingStatus = status
    },
  })

  // ---- 渲染期求值:用 computed（.value 读取发生在 render 闭包内 → 依赖归
  // 本组件渲染 effect;此处依赖 = contextValue 的 reactive 字段）----
  //  - 依赖未变 → 返回缓存对象（引用稳定,不重复建对象）
  //  - 依赖变化 → 置脏重算,并主动 trigger 读取本 computed 的渲染 effect
  //    （computed.ts 内部 effect 的 scheduler —— 惰性 computed 也能驱动重渲染）
  //  - 两个 computed 相互独立:class 变化只重算 elementProps,state 缓存不受影响
  const state = computed<AvatarRootState>(() => ({
    imageLoadingStatus: contextValue.imageLoadingStatus,
  }))
  const elementProps = computed<Record<string, any>>(() => {
    const out: Record<string, any> = {}
    for (const k in elementRefs) out[k] = elementRefs[k].value
    return out
  })

  // React: useRenderElement('span', componentProps, { state, ref, props, … }) →
  // ActView: 同名 helper 双参形态;组件 props 逐字段以 .value 活引用传入
  // （⚠️ className/style/render 进 componentProps,state/ref/props/mapping 进 params;
  //  ⚠️ toRefs 只为「实际传入的键」建引用——未传的 prop 解构为 undefined,
  //   访问必须走可选链?.value）
  // React: <AvatarRootContext.Provider value={contextValue}>{element}</…>
  // ActView: createContext 的 .Provider 组件同款包裹
  return (
    <AvatarRootContext.Provider value={contextValue}>
      {useRenderElement(
        'span',
        {
          className: className?.value,
          render: render?.value,
          style: style?.value,
        },
        {
          state: state.value,
          ref: props.ref, // ⚠️ ref 对象本体直传（禁止 .value 解包,见上）
          props: elementProps.value,
          stateAttributesMapping: avatarStateAttributesMapping,
        },
      )}
    </AvatarRootContext.Provider>
  )
}
