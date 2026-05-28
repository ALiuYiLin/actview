/**
 * Slot 提取 — 从 VNode children 中提取 template[slot] 为命名 props
 */

import { isVNode } from '@actview/jsx';
import type { VNode } from '@actview/jsx';

/**
 * 输入: children=[template(slot=header), p, template(slot=footer)]
 * 输出: props.header=[slotChildren], props.footer=[slotChildren], props.children=[p]
 */
export function extractSlotProps(
  props: Record<string, any>,
  children: VNode[] | string | null,
): Record<string, any> {
  const raw = Array.isArray(children) ? children : null;
  if (!raw) return props;

  const result: Record<string, any> = {};
  for (const key of Object.keys(props)) result[key] = props[key];

  const defaultChildren: any[] = [];
  for (const child of raw) {
    if (isVNode(child) && child.type === 'template' && child.props?.slot) {
      result[child.props.slot] = child.children;
    } else {
      defaultChildren.push(child);
    }
  }

  result.children = defaultChildren.length > 0 ? defaultChildren : null;
  return result;
}
