// ======== DOM Diff 算法 ========

function getChildKey(node: Node): any {
  return (node as any)._key;
}

export function reconcileFragmentChildren(
  parent: Node,
  startAnchor: Node,
  endAnchor: Node,
  oldChildren: Node[],
  newChildren: Node[]
) {
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getChildKey(child);
    if (key != null) oldKeyMap.set(key, child);
  }

  const useKeys = newChildren.length > 0 && newChildren.some(c => getChildKey(c) != null);

  if (useKeys) {
    const reused = new Set<Node>();
    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const key = getChildKey(newChild);
      let oldChild: Node | undefined;
      if (key != null && oldKeyMap.has(key)) {
        oldChild = oldKeyMap.get(key)!;
        oldKeyMap.delete(key);
        reused.add(oldChild);
        diffElement(oldChild, newChild);
      }
      const targetNode = oldChild ?? newChild;
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
        diffElement(oldChild, newChild);
      }
    }
  }
}

function syncAttributes(oldNode: Element, newNode: Element) {
  Array.from(oldNode.attributes).forEach(attr => {
    if (!newNode.hasAttribute(attr.name)) oldNode.removeAttribute(attr.name);
  });
  Array.from(newNode.attributes).forEach(attr => {
    if (oldNode.getAttribute(attr.name) !== attr.value) oldNode.setAttribute(attr.name, attr.value);
  });
  if ('value' in newNode && 'value' in oldNode) {
    const newValue = (newNode as any).value;
    const oldHasValueAttr = oldNode.hasAttribute('value');
    const newHasValueAttr = newNode.hasAttribute('value');
    if ((newNode as any).value !== (oldNode as any).value) {
      if (oldHasValueAttr || newHasValueAttr || newValue !== '') {
        (oldNode as any).value = newValue;
      }
    }
  }
}

function syncListeners(oldNode: Element, newNode: Element) {
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

function syncStyles(oldNode: Element, newNode: Element) {
  const oldStyle = (oldNode as HTMLElement | SVGElement).style;
  const newStyle = (newNode as HTMLElement | SVGElement).style;
  if (oldStyle.cssText !== newStyle.cssText) {
    oldStyle.cssText = newStyle.cssText;
  }
}

function reconcileChildren(parent: Node, oldChildren: Node[], newChildren: Node[]) {
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getChildKey(child);
    if (key != null) oldKeyMap.set(key, child);
  }

  const useKeys = newChildren.length > 0 && newChildren.some(c => getChildKey(c) != null);

  if (useKeys) {
    const reused = new Set<Node>();
    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const key = getChildKey(newChild);
      let oldChild: Node | undefined;
      if (key != null && oldKeyMap.has(key)) {
        oldChild = oldKeyMap.get(key)!;
        oldKeyMap.delete(key);
        reused.add(oldChild);
        diffElement(oldChild, newChild);
      }
      const targetNode = oldChild ?? newChild;
      const refNode = parent.childNodes[i];
      if (targetNode !== refNode) {
        parent.insertBefore(targetNode, refNode);
      }
    }
    for (const child of oldChildren) {
      if (!reused.has(child)) {
        parent.removeChild(child);
      }
    }
  } else {
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      const oc = oldChildren[i];
      const nc = newChildren[i];
      if (!oc && nc) {
        parent.appendChild(nc);
      } else if (oc && !nc) {
        parent.removeChild(oc);
      } else if (oc && nc) {
        diffElement(oc, nc);
      }
    }
  }
}

export function diffElement(oldNode: Node, newNode: Node): Node {
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
    oldNode.parentNode?.replaceChild(newNode, oldNode);
    return newNode;
  }

  if (oldNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent) {
      oldNode.textContent = newNode.textContent;
    }
    return oldNode;
  }

  const isOldStyled = oldNode instanceof HTMLElement || oldNode instanceof SVGElement;
  const isNewStyled = newNode instanceof HTMLElement || newNode instanceof SVGElement;
  if (isOldStyled && isNewStyled) {
    if ((oldNode as any)._componentInstance && (newNode as any)._componentInstance) {
      const oldInstance = (oldNode as any)._componentInstance;
      const newInstance = (newNode as any)._componentInstance;
      if (oldInstance.setupFn !== newInstance.setupFn) {
        oldNode.parentNode?.replaceChild(newNode, oldNode);
        return newNode;
      }
      oldInstance.props = newInstance.props;
      if (oldInstance.setupFn === oldInstance.renderFn) {
        const newDom = oldInstance.setupFn(oldInstance.props);
        return diffElement(oldNode, newDom as Node);
      }
      syncAttributes(oldNode, newNode);
      syncStyles(oldNode, newNode);
      syncListeners(oldNode, newNode);
      return oldNode;
    }

    syncAttributes(oldNode, newNode);
    syncStyles(oldNode, newNode);
    syncListeners(oldNode, newNode);

    const oldChildren = Array.from(oldNode.childNodes);
    const newChildren = Array.from(newNode.childNodes);
    reconcileChildren(oldNode, oldChildren, newChildren);

    return oldNode;
  }

  return oldNode;
}
