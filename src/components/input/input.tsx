/**
 * MyInput 输入框组件
 *
 * @example
 * <MyInput type="primary" placeholder="请输入"></MyInput>
 * <MyInput size="lg" disabled></MyInput>
 *
 * @props
 * - type: primary | success | danger | warning （边框颜色）
 * - size: sm | lg
 * - disabled: 禁用状态
 * - readonly: 只读状态
 * - placeholder: 占位文字
 * - value: 默认值
 * - input-type: text | password | number | email | tel | url（原生 input type）
 * - clearable: 显示清除按钮
 */
import './input.css'

export type MyInputProps = {
  type?: string;
  size?: string;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  value?: string;
  "input-type"?: string;
  clearable?: boolean;
  "data-id"?: string;
  onInput?: (e: Event) => void;
};

export const MyInput = (props: MyInputProps) => {
  const kls = [
    "input-wrapper",
    props.type ? `input-${props.type}` : "",
    props.size ? `input-${props.size}` : "",
    props.disabled !== undefined ? "input-disabled" : "",
    props.readonly !== undefined ? "input-readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={kls} data-id={props["data-id"]}>
      <slot name="prefix"></slot>
      <input
        className="input-inner"
        type={props["input-type"] || "text"}
        placeholder={props.placeholder || ""}
        value={props.value || ""}
        disabled={props.disabled !== undefined}
        readOnly={props.readonly !== undefined}
        onInput={props.onInput}
      />
      {props.clearable !== undefined && (
        <span className="input-clear">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
      )}
      <slot name="suffix"></slot>
    </div>
  );
};
