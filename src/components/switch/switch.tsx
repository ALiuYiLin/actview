/**
 * MySwitch 开关组件
 *
 * @example
 * <MySwitch checked></MySwitch>
 * <MySwitch type="primary" size="lg"></MySwitch>
 *
 * @props
 * - type: primary | success | danger | warning （颜色）
 * - size: sm | lg
 * - checked: 默认选中
 * - disabled: 禁用状态
 * - label-on: 开启时的文字
 * - label-off: 关闭时的文字
 */
import './switch.css'

export type MySwitchProps = {
  type?: string;
  size?: string;
  checked?: boolean;
  disabled?: boolean;
  "label-on"?: string;
  "label-off"?: string;
  "data-id"?: string;
  onToggle?: () => void;
};

export const MySwitch = (props: MySwitchProps) => {
  const kls = [
    "switch",
    props.type ? `switch-${props.type}` : "switch-primary",
    props.size ? `switch-${props.size}` : "",
    props.checked !== undefined ? "switch-checked" : "",
    props.disabled !== undefined ? "switch-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return ()=>(
    <div className={kls} tabIndex={0} role="switch" data-id={props["data-id"]} onClick={props.onToggle}>
      <div className="switch-handle">
        <slot></slot>
      </div>
      {(props["label-on"] || props["label-off"]) && (
        <span className="switch-label">
          {props.checked !== undefined
            ? props["label-on"] || ""
            : props["label-off"] || ""}
        </span>
      )}
    </div>
  );
};
