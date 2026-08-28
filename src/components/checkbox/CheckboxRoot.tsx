// ============================================================
// CheckboxRoot —— 多 ref 场景案例组件
//
// 一个 Checkbox,同一时刻有【四方】共享 DOM 引用:
//   ① 使用方 inputRef        —— 挂在隐藏 <input> 上(应用代码自持)
//   ② 库内部 internalInput   —— 挂在同一 input 上(库点击时写 .checked)
//   ③ Group 注册函数 ref     —— 挂载 register(el)/卸载 register(null)
//   ④ 转发 ref(props.ref)   —— 挂在根 <button> 上(父拿按钮 DOM)
// 另:render 节点自带 ref 走 useRenderElement 合并链第 2 源(见 T4 用例)。
//
// 合并全部经由 internals/useMergedRefs:
//   mergedInputRef = useMergedRefs(props.inputRef, internalInput, registerInput)
//   根按钮 ref     = props.ref(经 useRenderElement params.ref 直传)
//
// 行为:点击按钮 → checked 翻转 → 同步写隐藏 input.checked(演示库内部
// 读/写自身 ref)→ onChange 回调。disabled 时注册函数收到 null(Group 反注册)。
// ============================================================

import { computed, ref, toRefs, type Ref } from 'actview'
import { useRenderElement } from '../internals/useRenderElement'
import { useMergedRefs } from '../internals/useMergedRefs'
import type { BaseUIComponentProps } from '../internals/types'
import { useCheckboxGroupContext } from './checkbox-context'

export interface CheckboxRootState {
  checked: boolean
  disabled: boolean
}

export interface CheckboxRootProps
  extends BaseUIComponentProps<'button', CheckboxRootState> {
  /** ① 使用方 ref:挂到隐藏 <input>(多 ref 演示源) */
  inputRef?: Ref<HTMLInputElement | null>
  /** 非受控初始值(受控形态后续按需补) */
  defaultChecked?: boolean
  /** 变化回调(统一写入口之外的观察口) */
  onCheckedChange?: (checked: boolean) => void
  /** 提交给 Group 的值(注册元数据) */
  value?: string
  disabled?: boolean
}

export function CheckboxRoot(props: CheckboxRootProps) {
  // 值形 props 走 toRefs(活引用,渲染期 .value);ref 形 props 走原始直传
  // （props.inputRef / props.ref 的【值本身就是 ref 对象】——双重解包陷阱,
  //   见 AvatarRoot 同款注释)
  const { className, render, style, ...elementRefs } = toRefs(props) as Record<
    string,
    Ref<any>
  >

  // 非受控状态(案例从简;受控形态 = props.checked 优先,后续补)
  const checked = ref<boolean>(!!props.defaultChecked)

  // ② 库内部自持的 ref:点击时写 input.checked / 必要时聚焦
  const internalInput = ref<HTMLInputElement | null>(null)

  // Group 注册(可独立使用:无 Group 时 ctx 为 null,注册降级为 no-op)
  const groupCtx = useCheckboxGroupContext()
  const registration = {
    el: null as HTMLInputElement | null,
    value: props.value,
    controlRef: internalInput,
  }
  // ③ 注册函数 ref:挂载 → register(el);卸载 → applyRef(fn, null) → 反注册
  const registerInput = (el: HTMLInputElement | null) => {
    registration.el = el
    groupCtx?.register(registration)
  }

  // 四方合并:① 用户 inputRef + ② 库内部 + ③ Group 注册函数
  const mergedInputRef = useMergedRefs(
    props.inputRef,
    internalInput,
    registerInput,
  )

  // ---- 渲染期派生(computed:依赖未变走缓存,变化置脏重算+trigger 渲染) ----
  const state = computed<CheckboxRootState>(() => ({
    checked: checked.value,
    disabled: !!props.disabled,
  }))
  // 透传 props(排除框架消费键);渲染期 .value 取值保持活引用
  const EXCLUDE = new Set([
    'className', 'render', 'style', 'inputRef', 'defaultChecked',
    'onCheckedChange', 'value', 'disabled', 'ref', 'children',
  ])
  const elementProps = computed<Record<string, any>>(() => {
    const out: Record<string, any> = {}
    for (const k in elementRefs) {
      if (EXCLUDE.has(k)) continue
      out[k] = elementRefs[k].value
    }
    return out
  })

  // 行为:点击 → 翻转 → 同步隐藏 input(演示 ② 内部 ref 的读/写)
  const handleRootClick = () => {
    if (props.disabled) return
    const next = !checked.value
    checked.value = next
    if (internalInput.value) internalInput.value.checked = next
    props.onCheckedChange?.(next)
  }

  return (
    <>
      {useRenderElement(
        'button',
        {
          className: className?.value,
          render: render?.value,
          style: style?.value,
        },
        {
          state: state.value,
          ref: props.ref, // ④ 转发 ref:根按钮(对象本体直传)
          props: [
            {
              type: 'button',
              role: 'checkbox',
              'aria-checked': String(checked.value),
              'data-value': props.value ?? '',
              onClick: handleRootClick,
            },
            elementProps.value,
          ],
          stateAttributesMapping: {},
        },
      )}
      {/* 隐藏 input:①+②+③ 三方 ref 的合并目标 */}
      <input
        type="checkbox"
        aria-hidden="true"
        tabIndex={-1}
        value={props.value ?? ''}
        disabled={!!props.disabled}
        ref={mergedInputRef}
        style="position:absolute;opacity:0;pointer-events:none"
      />
    </>
  )
}
