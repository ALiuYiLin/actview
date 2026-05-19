import { ParsedOption } from "../types";
import { resolveComponents } from "./component";
import { setCurrentUpdateFn } from "../hooks";
import { diff, patchKeyedChildren, hasKeyedChildren } from "./diff";
type RenderResult = string | HTMLElement | Text | DocumentFragment | SVGElement;

/** 执行 render 并替换当前元素，返回新的跟踪元素 */
function bindRender(currentEl: Element, render: (() => RenderResult) | undefined): Element {
  if (!render || typeof render !== "function") return currentEl;
  if (!currentEl.parentNode) return currentEl;

  const result = render();

  if (typeof result === "string") {
    const temp = document.createElement("div");
    temp.innerHTML = result.trim();
    const newEl = temp.firstElementChild;
    if (newEl) return diff(currentEl, newEl) as Element;
  } else if (result instanceof DocumentFragment) {
    if (currentEl.parentNode) {
      const parent = currentEl.parentNode as HTMLElement;
      let startAnchor = (currentEl as any)._fragmentStartAnchor as Comment | undefined;
      let endAnchor = (currentEl as any)._fragmentEndAnchor as Comment | undefined;
      const newChildren = Array.from(result.childNodes);

      if (!startAnchor || !endAnchor) {
        startAnchor = document.createComment("fragment-start");
        endAnchor = document.createComment("fragment-end");
        currentEl.replaceWith(startAnchor);
        startAnchor.after(endAnchor);
        for (const child of newChildren) parent.insertBefore(child, endAnchor);
      } else {
        const oldChildren: Node[] = [];
        let current: Node | null = startAnchor.nextSibling;
        while (current && current !== endAnchor) { oldChildren.push(current); current = current.nextSibling; }

        if (hasKeyedChildren(newChildren)) {
          patchKeyedChildren(parent, oldChildren, newChildren, endAnchor);
        } else {
          const maxLen = Math.max(oldChildren.length, newChildren.length);
          for (let i = 0; i < maxLen; i++) {
            const oc = oldChildren[i], nc = newChildren[i];
            if (!oc && nc) parent.insertBefore(nc, endAnchor);
            else if (oc && !nc) parent.removeChild(oc);
            else if (oc && nc) diff(oc, nc);
          }
        }
      }

      const trackerEl = findTrackerElement(parent, startAnchor, endAnchor);
      (trackerEl as any)._fragmentStartAnchor = startAnchor;
      (trackerEl as any)._fragmentEndAnchor = endAnchor;
      return trackerEl;
    }
  } else if (result instanceof Element) {
    return diff(currentEl, result) as Element;
  }
  return currentEl;
}

function findTrackerElement(parent: Node, start: Comment, end: Comment): Element {
  let current: Node | null = start.nextSibling;
  while (current && current !== end) {
    if (current instanceof Element) return current;
    current = current.nextSibling;
  }
  const placeholder = document.createElement("span");
  placeholder.style.display = "none";
  parent.insertBefore(placeholder, end);
  return placeholder;
}

/** 挂载组件到元素 — 组件式写法 */
export function compile(el: Element, render: () => any): void {
  // render 产生的 JSX 经 createElement → mountComponent 自动处理响应式更新
  const result = render();
  if (typeof result === 'function') {
    // setup 模式：执行 render 函数获取首次 DOM
    bindRender(el, result);
  } else if (result instanceof Node) {
    // 直接返回 DOM
    el.replaceWith(result);
  } else if (typeof result === 'string') {
    el.innerHTML = result;
  }
}

function processSlotProps(props: Record<string, any>) {
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (!Array.isArray(value)) continue;
    if (value.length === 0 || !(value[0] instanceof Node)) continue;

    const resolvedNodes: Node[] = [];
    value.forEach((node: Node) => {
      if (node instanceof Element) {
        const childOptions = resolveComponents(node);
        if (childOptions.length > 0) {
          childOptions.forEach((op) => compileCustom(op));
          const firstOp = childOptions[0];
          if (firstOp.el === node && firstOp.render) {
            const result = firstOp.render(firstOp.props);
            if (result instanceof Node) resolvedNodes.push(result);
            else if (typeof result === "string") {
              const wrapper = document.createElement("span");
              wrapper.innerHTML = result;
              resolvedNodes.push(...Array.from(wrapper.childNodes));
            }
          } else resolvedNodes.push(node);
        } else resolvedNodes.push(node);
      } else resolvedNodes.push(node);
    });
    props[key] = resolvedNodes;
  }
}

export function compileCustom(option: ParsedOption) {
  const { el, render, props } = option;
  const updateFn = () => {
    if (render) {
      processSlotProps(props);
      const result = render(props);
      el.replaceWith(result);
    }
  };
  setCurrentUpdateFn(updateFn);
  updateFn();
  setCurrentUpdateFn(null);
}
