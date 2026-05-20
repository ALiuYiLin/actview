/** 挂载组件到元素 */
export function compile(el: Element, render: () => any): void {
  const result = render();
  if (typeof result === 'function') {
    const dom = result();
    if (dom instanceof Node) {
      el.textContent = '';
      el.append(dom);
    }
  } else if (result instanceof Node) {
    el.textContent = '';
    el.append(result);
  }
}