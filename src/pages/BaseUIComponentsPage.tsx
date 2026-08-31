// ============================================================
// Base UI 移植组件展示：
//   Checkbox（Group 统管 value/onValueChange + Root 注册 + Indicator）
//   Avatar  （state/context 驱动：render prop 收 (props, state)、
//            className 函数形态、setImageLoadingStatus 状态机）
// ============================================================
import { reactive, ref } from 'actview'
import {
  CheckboxGroup,
  CheckboxRoot,
  CheckboxIndicator,
  type CheckboxGroupApi,
} from '../components/checkbox'
import { AvatarRoot, useAvatarRootContext } from '../components/avatar'
import { cardStyle, btnStyle, hintStyle } from '../styles'

const rowStyle: any = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  alignItems: 'flex-start',
}
const badgeStyle: any = {
  padding: '2px 10px',
  borderRadius: 999,
  background: '#e0e7ff',
  color: '#4338ca',
  fontSize: 12,
}
const checkboxButtonStyle: any = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  padding: '4px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 14,
}

/** 模拟图片加载：setup 同步置 loading → 500ms 后 loaded（context 驱动根重渲染） */
function AvatarStatusSimulator() {
  const ctx = useAvatarRootContext()
  ctx.setImageLoadingStatus('loading')
  setTimeout(() => ctx.setImageLoadingStatus('loaded'), 500)
  return null
}

export function BaseUIComponentsPage() {
  const groupRef = ref<CheckboxGroupApi | null>(null)
  // 受控选中值（React 对齐：绑在 Group 的 value 上，初始预置 banana）
  const selections = reactive<string[]>(['banana'])
  const toggleCount = ref(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ---------- Checkbox：Group 统管 value + Indicator ---------- */}
      <div class="demo-card" style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>
          Checkbox（Base UI 移植：Group 统管 value + Indicator）
        </h2>
        <CheckboxGroup
          groupRef={groupRef}
          value={selections}
          onValueChange={(values) => {
            toggleCount.value++
            selections.splice(0, selections.length, ...values)
          }}
          aria-label="水果多选"
          className="demo-checkbox-group"
        >
          <div style={rowStyle}>
            <CheckboxRoot value="apple" style={checkboxButtonStyle}>
              <CheckboxIndicator /> 🍎 苹果
            </CheckboxRoot>
            <CheckboxRoot value="banana" style={checkboxButtonStyle}>
              <CheckboxIndicator /> 🍌 香蕉（默认选中）
            </CheckboxRoot>
            <CheckboxRoot value="cherry" disabled style={checkboxButtonStyle}>
              <CheckboxIndicator /> 🍒 樱桃（disabled）
            </CheckboxRoot>
          </div>
        </CheckboxGroup>
        <p style={hintStyle}>
          已选：{selections.length ? selections.join('、') : '（无）'}｜
          切换次数：{toggleCount.value}｜
          Group 注册成员：{groupRef.value?.members.length ?? 0}
        </p>
        <button
          style={btnStyle}
          onclick={() => selections.splice(0, selections.length)}
        >
          清空选择
        </button>
        <p style={hintStyle}>
          value / onValueChange 绑在 Group 上（React 对齐）；Root 只注册
          value，勾选状态从 Group context 派生；Indicator 读 Root context
          渲染勾。隐藏 input 由 ①使用方 ref + ②库内部 ref + ③Group 注册函数
          三方合并（useMergedRefs）；点击根按钮 → 翻转并同步写 input.checked。
        </p>
      </div>

      {/* ---------- Avatar：state/context 驱动（render prop + className 函数形态） ---------- */}
      <div class="demo-card" style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Avatar（Base UI 移植：state/context 驱动）</h2>
        <AvatarRoot
          className={(s) => `avatar-demo is-${s.imageLoadingStatus}`}
          render={(p: any, s: any) => {
            // children 是插槽桥接键：抽离后经 JSX children 渲染（避免 {...p}
            // 展开把 vnode 当 prop 设置）
            const { children, ...rest } = p
            return (
              <span {...rest} data-status={s.imageLoadingStatus} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span style={badgeStyle}>
                  {s.imageLoadingStatus === 'loaded'
                    ? '🖼️ 已加载'
                    : s.imageLoadingStatus === 'loading'
                      ? '⏳ 加载中…'
                      : '（空闲）'}
                </span>
                {children}
              </span>
            )
          }}
        >
          <AvatarStatusSimulator />
        </AvatarRoot>
        <p style={hintStyle}>
          render prop 收 (props, state)——state.imageLoadingStatus 由子部件经
          context（useAvatarRootContext）驱动；className 函数形态按状态输出
          is-loading / is-loaded；根元素自动携带 data-status。
        </p>
      </div>
    </div>
  )
}
