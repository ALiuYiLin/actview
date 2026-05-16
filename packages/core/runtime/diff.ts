
/**
 * 统一的 DOM Diff 算法
 * 整合 core 和 jsx 两套 diff 实现，同时支持 HTMLElement 和 SVGElement
 * @param oldNode 旧节点
 * @param newNode 新节点
 * @returns 实际更新后的节点（如果是替换操作，返回新节点；如果是属性更新，返回旧节点）
 */
export function diff(oldNode: Node, newNode: Node): Node {
  // 1. 如果节点类型不同，直接替换
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
    oldNode.parentNode?.replaceChild(newNode, oldNode);
    return newNode;
  }

  // 2. 文本节点处理
  if (oldNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent) {
      oldNode.textContent = newNode.textContent;
    }
    return oldNode;
  }

  // 3. 元素节点处理（同时支持 HTMLElement 和 SVGElement）
  const isOldStyled = oldNode instanceof HTMLElement || oldNode instanceof SVGElement;
  const isNewStyled = newNode instanceof HTMLElement || newNode instanceof SVGElement;
  if (isOldStyled && isNewStyled) {
    // 如果新旧节点都是组件的根节点，跳过深度 diff（由组件自己管理）
    // 此场景发生在父组件 re-render 遇到子组件边界时
    if ((oldNode as any)._componentInstance && (newNode as any)._componentInstance) {
      const oldInstance = (oldNode as any)._componentInstance;
      const newInstance = (newNode as any)._componentInstance;
      // 组件函数不同时（路由切换等）→ 完全替换
      if (oldInstance.setupFn !== newInstance.setupFn) {
        oldNode.parentNode?.replaceChild(newNode, oldNode);
        return newNode;
      }
      // 同一组件：只同步 props
      oldInstance.props = newInstance.props;
      syncAttributes(oldNode, newNode);
      syncListeners(oldNode, newNode);
      return oldNode;
    }

    syncAttributes(oldNode, newNode);
    syncStyles(oldNode, newNode);
    syncListeners(oldNode, newNode);

    // 递归子节点（keyed diff，按 _key 匹配）
    const oldChildren = Array.from(oldNode.childNodes);
    const newChildren = Array.from(newNode.childNodes);
    reconcileChildren(oldNode, oldChildren, newChildren);

    return oldNode;
  }

  // DocumentFragment 处理（简单策略：直接把新内容插进去，不做精细 diff）
  if (oldNode instanceof DocumentFragment || newNode instanceof DocumentFragment) {
    return newNode;
  }

  return oldNode;
}

/** @alias {@link syncAttributes} — 兼容 compile.ts 等旧引用 */
export const updateAttributes = syncAttributes;
/** @alias {@link syncListeners} — 兼容 compile.ts 等旧引用 */
export const updateListeners = syncListeners;

export function syncAttributes(oldNode: Element, newNode: Element) {
  Array.from(oldNode.attributes).forEach(attr => {
    if (!newNode.hasAttribute(attr.name)) oldNode.removeAttribute(attr.name);
  });
  Array.from(newNode.attributes).forEach(attr => {
    if (oldNode.getAttribute(attr.name) !== attr.value) oldNode.setAttribute(attr.name, attr.value);
  });

  // 特殊处理 input value
  if ('value' in newNode && 'value' in oldNode) {
    const newValue = (newNode as any).value;
    const oldHasValueAttr = oldNode.hasAttribute('value');
    const newHasValueAttr = newNode.hasAttribute('value');
    if ((newNode as any).value !== (oldNode as any).value) {
      // 曾受控 / 正在受控 / 非空值 → 更新
      if (oldHasValueAttr || newHasValueAttr || newValue !== '') {
        (oldNode as any).value = newValue;
      }
    }
  }
}

export function syncListeners(oldNode: Element, newNode: Element) {
  const oldListeners = (oldNode as any)._listeners || {};
  const newListeners = (newNode as any)._listeners || {};

  for (const [name, listener] of Object.entries(oldListeners)) {
    if (!newListeners[name] || newListeners[name] !== listener) {
      oldNode.removeEventListener(name, listener as EventListener);
      delete oldListeners[name];
    }
  }
  for (const [name, listener] of Object.entries(newListeners)) {
    if (!oldListeners[name]) {
      oldNode.addEventListener(name, listener as EventListener);
      oldListeners[name] = listener;
    }
  }
  (oldNode as any)._listeners = oldListeners;
}

export function syncStyles(oldNode: Element, newNode: Element) {
  const oldStyle = (oldNode as HTMLElement | SVGElement).style;
  const newStyle = (newNode as HTMLElement | SVGElement).style;
  if (oldStyle.cssText !== newStyle.cssText) {
    oldStyle.cssText = newStyle.cssText;
  }
}

// ======== 子节点协调 ========

function getKey(node: Node): any {
  return (node as any)._key;
}

export function hasKeyedChildren(children: Node[]): boolean {
  return children.length > 0 && children.some(c => getKey(c) !== undefined);
}

/**
 * 带 key 的子节点协调（keyed reconciliation）
 * 匹配新旧子节点列表中的 _key，保留已存在 DOM 节点的状态（如 input 输入内容）
 * 算法：遍历新子节点 → 按 key 匹配旧节点 → diff 后移动到正确位置 → 删除残余旧节点
 */
export function reconcileChildren(parent: Node, oldChildren: Node[], newChildren: Node[]) {
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getKey(child);
    if (key != null) oldKeyMap.set(key, child);
  }

  // 只要有任意子节点带 key 就启用 keyed 模式
  const useKeys = newChildren.length > 0 && newChildren.some(c => getKey(c) != null);

  if (useKeys) {
    const reused = new Set<Node>();

    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const key = getKey(newChild);

      let oldChild: Node | undefined;
      if (key != null && oldKeyMap.has(key)) {
        oldChild = oldKeyMap.get(key)!;
        oldKeyMap.delete(key);
        reused.add(oldChild);
        diff(oldChild, newChild);
      }

      const targetNode = oldChild ?? newChild;
      const refNode = parent.childNodes[i];
      if (targetNode !== refNode) {
        parent.insertBefore(targetNode, refNode);
      }
    }

    // 移除未被复用的旧节点
    for (const child of oldChildren) {
      if (!reused.has(child)) {
        parent.removeChild(child);
      }
    }
  } else {
    // 无 key 时使用索引匹配（兼容无 key 的简单场景）
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      const oc = oldChildren[i];
      const nc = newChildren[i];
      if (!oc && nc) {
        parent.appendChild(nc);
      } else if (oc && !nc) {
        parent.removeChild(oc);
      } else if (oc && nc) {
        diff(oc, nc);
      }
    }
  }
}

/**
 * Fragment 子节点协调（支持 keyed diff）
 * 与 reconcileChildren 逻辑相同，但使用锚点边界定位
 */
export function reconcileFragmentChildren(
  parent: Node,
  startAnchor: Node,
  endAnchor: Node,
  oldChildren: Node[],
  newChildren: Node[]
) {
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getKey(child);
    if (key != null) oldKeyMap.set(key, child);
  }

  const useKeys = newChildren.length > 0 && newChildren.some(c => getKey(c) != null);

  if (useKeys) {
    const reused = new Set<Node>();

    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const key = getKey(newChild);

      let oldChild: Node | undefined;
      if (key != null && oldKeyMap.has(key)) {
        oldChild = oldKeyMap.get(key)!;
        oldKeyMap.delete(key);
        reused.add(oldChild);
        diff(oldChild, newChild);
      }

      const targetNode = oldChild ?? newChild;

      // 从当前 live DOM 中找到第 i 个子节点做参考（相对 startAnchor）
      let refNode: Node = endAnchor;
      let count = 0;
      let node: Node | null = startAnchor.nextSibling;
      while (node && node !== endAnchor) {
        if (count >= i) { refNode = node; break; }
        count++;
        node = node.nextSibling;
      }

      if (targetNode !== refNode && refNode.parentNode === parent) {
        parent.insertBefore(targetNode, refNode);
      }
    }

    for (const child of oldChildren) {
      if (!reused.has(child) && child.parentNode === parent) {
        parent.removeChild(child);
      }
    }
  } else {
    // 无 key 时使用索引匹配
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      const oldChild = oldChildren[i];
      const newChild = newChildren[i];
      if (!oldChild && newChild) {
        if (endAnchor.parentNode === parent) {
          parent.insertBefore(newChild, endAnchor);
        }
      } else if (oldChild && !newChild) {
        if (oldChild.parentNode === parent) {
          parent.removeChild(oldChild);
        }
      } else if (oldChild && newChild) {
        diff(oldChild, newChild);
      }
    }
  }
}

/**
 * 旧版 Keyed children diff（保留以兼容 compile.ts 等调用方）
 * 使用从后往前的锚点定位策略，支持可选的 anchor 参数（Fragment 端锚点）
 */
export function patchKeyedChildren(parent: Node, oldChildren: Node[], newChildren: Node[], anchor?: Node | null) {
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getKey(child);
    if (key !== undefined) {
      oldKeyMap.set(key, child);
    }
  }

  const handledOldNodes = new Set<Node>();
  const resultNodes: Node[] = [];

  for (const newChild of newChildren) {
    const key = getKey(newChild);
    const oldChild = key !== undefined ? oldKeyMap.get(key) : undefined;

    if (oldChild) {
      diff(oldChild, newChild);
      resultNodes.push(oldChild);
      handledOldNodes.add(oldChild);
    } else {
      resultNodes.push(newChild);
    }
  }

  for (const child of oldChildren) {
    if (!handledOldNodes.has(child)) {
      parent.removeChild(child);
    }
  }

  let insertAnchor: Node | null = anchor ?? null;
  for (let i = resultNodes.length - 1; i >= 0; i--) {
    const node = resultNodes[i];
    if (node.parentNode !== parent) {
      parent.insertBefore(node, insertAnchor);
    } else if (node.nextSibling !== insertAnchor) {
      parent.insertBefore(node, insertAnchor);
    }
    insertAnchor = node;
  }
}

export function diffChildren(parent: HTMLElement, oldList: (Node | undefined | null)[], newList: (Node | undefined | null)[]) {
  const filteredOld = oldList.filter((n): n is Node => n != null);
  const filteredNew = newList.filter((n): n is Node => n != null);

  if (hasKeyedChildren(filteredNew)) {
    patchKeyedChildren(parent, filteredOld, filteredNew);
    return;
  }

  const maxLength = Math.max(filteredOld.length, filteredNew.length);
  for (let i = 0; i < maxLength; i++) {
    const oldNode = filteredOld[i];
    const newNode = filteredNew[i];

    if (!oldNode && newNode) {
      parent.appendChild(newNode);
    } else if (oldNode && !newNode) {
      parent.removeChild(oldNode);
    } else if (oldNode && newNode) {
      diff(oldNode, newNode);
    }
  }
}

export { getKey };
