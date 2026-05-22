/**
 * MyButton 组件定义
 * 支持 before、default、after 三个插槽
 *
 * @example
 * <MyButton type="primary" size="lg">
 *   <template #before><svg>...</svg></template>
 *   按钮文字
 * </MyButton>
 *
 * @props
 * - type: primary | secondary | success | danger | warning | ghost | link
 * - size: sm | lg
 * - disabled: 禁用状态
 * - loading: 加载状态
 */
import './button.css'
export type MyButtonProps = {
  type?: string;
  size?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  class?: string;
  'data-id'?: string;
  children?: string | Node | (Node | string)[];
  before?: Node[];
  after?: Node[];
};

export const MyButton = (props: MyButtonProps) => {
  // console.log('props: ', props);
    const kls = ['btn', props.type ? `btn-${props.type}` : '', props.size ? `btn-${props.size}` : '', props.disabled !== undefined ? 'btn-disabled' : '', props.loading !== undefined ? 'btn-loading' : '', props.class || ''].filter(Boolean).join(' ');
    return (
      <div className={kls} data-id={props['data-id']} onClick={props.onClick}>
        {props.before}
        {props.children}
        {props.after}
      </div>
    );
}
