// ============================================================
// Base UI 移植组件展示：
//   Checkbox（多 ref 合并 + Group 注册表 + render prop 自定义形态）
//   Avatar  （state/context 驱动：render prop 收 (props, state)、
//            className 函数形态、setImageLoadingStatus 状态机）
// ============================================================
import { reactive, ref } from 'actview'
import {
  CheckboxGroup,
  CheckboxRoot,
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

/** 模拟图片加载：setup 同步置 loading → 500ms 后 loaded（context 驱动根重渲染） */
function AvatarStatusSimulator() {
  const ctx = useAvatarRootContext()
  ctx.setImageLoadingStatus('loading')
  setTimeout(() => ctx.setImageLoadingStatus('loaded'), 500)
  return null
}

export function BaseUIComponentsPage() {
  const groupRef = ref<CheckboxGroupApi | null>(null)
  // 香蕉 defaultChecked 初始选中——同步进已选列表
  const selections = reactive<string[]>(['banana'])
  const toggleCount = ref(0)
  const onCheckedChange = (value: string) => (checked: boolean) => {
    toggleCount.value++
    const i = selections.indexOf(value)
    if (checked && i < 0) selections.push(value)
    else if (!checked && i >= 0) selections.splice(i, 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ---------- Checkbox：多选表单（多 ref + Group 注册） ---------- */}
      <div class="demo-card" style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Checkbox（Base UI 移植：多 ref + Group 注册）</h2>
        <CheckboxGroup groupRef={groupRef}>
          <div style={rowStyle}>
            <CheckboxRoot
              value="apple"
              defaultChecked={false}
              onCheckedChange={onCheckedChange('apple')}
              render={(p: any, s: any) => {
                const { children: _c, ...rest } = p
                return (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.checked} {...rest} /> 🍎 苹果
                  </label>
                )
              }}
            />
            <CheckboxRoot
              value="banana"
              defaultChecked={true}
              onCheckedChange={onCheckedChange('banana')}
              render={(p: any, s: any) => {
                const { children: _c, ...rest } = p
                return (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.checked} {...rest} /> 🍌 香蕉（默认选中）
                  </label>
                )
              }}
            />
            <CheckboxRoot
              value="cherry"
              disabled
              onCheckedChange={onCheckedChange('cherry')}
              render={(p: any, s: any) => {
                const { children: _c, ...rest } = p
                return (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'not-allowed', opacity: 0.6 }}>
                    <input type="checkbox" checked={s.checked} {...rest} /> 🍒 樱桃（disabled）
                  </label>
                )
              }}
            />
          </div>
        </CheckboxGroup>
        <p style={hintStyle}>
          已选：{selections.length ? selections.join('、') : '（无）'}｜
          切换次数：{toggleCount.value}｜
          Group 注册成员：{groupRef.value?.members.length ?? 0}
        </p>
        <button
          style={btnStyle}
          onclick={() => {
            const cur = [...selections]
            for (const k of cur) selections.splice(selections.indexOf(k), 1)
          }}
        >
          清空选择
        </button>
        <p style={hintStyle}>
          每个 Checkbox 的隐藏 input 由 ①使用方 ref + ②库内部 ref + ③Group 注册函数
          三方合并（useMergedRefs）；点击根元素 → 翻转并同步写 input.checked。
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
