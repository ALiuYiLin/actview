/**
 * DOM 工具 — SVG 判断 + 属性 diff
 */

// ======== SVG ========

export const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect',
  'g', 'defs', 'use', 'symbol', 'clipPath', 'mask', 'pattern', 'image',
  'text', 'tspan', 'textPath', 'foreignObject', 'marker', 'linearGradient',
  'radialGradient', 'stop', 'filter', 'animate', 'animateTransform',
]);

export function isSvgTag(tag: string): boolean {
  return SVG_TAGS.has(tag);
}

// ======== Props Diff ========

/**
 * 比较新旧 props，增量更新 DOM 属性/事件
 */
export function patchProps(el: Element, oldProps: Record<string, any>, newProps: Record<string, any>): void {
  // 移除旧属性
  for (const key of Object.keys(oldProps)) {
    if (key === 'children' || key === 'key') continue;
    if (!(key in newProps)) {
      if (key.startsWith('on') && typeof oldProps[key] === 'function') {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else if (key === 'style' && typeof oldProps[key] === 'object') {
        (el as HTMLElement).style.cssText = '';
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // 新增/更新属性
  for (const [key, value] of Object.entries(newProps)) {
    if (key === 'children' || key === 'key') continue;
    if (value === oldProps[key]) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      if (oldProps[key]) el.removeEventListener(eventName, oldProps[key]);
      el.addEventListener(eventName, value);
    } else if (key === 'className' || key === 'class') {
      el.setAttribute('class', String(value));
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign((el as HTMLElement).style, value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else if (value !== false && value != null) {
      el.setAttribute(key, String(value));
    } else if (value === false || value == null) {
      el.removeAttribute(key);
    }
  }
}
