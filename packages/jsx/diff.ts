// ======== DOM Diff 算法 ========
/**
 * 直接在真实 DOM 上做增量更新，无虚拟 DOM 中间层。
 * 策略：类型不同则替换 → 文本则更新内容 → 组件边界隔离 → 元素则同步属性 + 递归子节点。
 */

// 组件卸载时取消订阅其 refs（由 @actview/core 注入）
let _unsubscribeComponent: ((callback: () => void, refs: Set<any>) => void) | null = null;
export function injectUnsubscribe(fn: (callback: () => void, refs: Set<any>) => void) {
  _unsubscribeComponent = fn;
}

function getChildKey(node: Node): any {
  return (node as any)._key;
}

/**
 * Fragment 子节点协调
 * 与 reconcileChildren 逻辑相同，但使用 startAnchor/endAnchor 定位而非 parent.childNodes。
 * 遍历新旧子节点 → 按 key 匹配 → diff → 相对锚点插入/移除。
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
      // 从 startAnchor 向后数到第 i 个 live 节点作为参考位置
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
        const inst = (child as any)._componentInstance;
        if (inst) _unsubscribeComponent?.(inst.update, inst.refs);
        parent.removeChild(child);
      }
    }
  } else {
    // 无 key：按索引一一比对
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
          const inst = (oldChild as any)._componentInstance;
          if (inst) _unsubscribeComponent?.(inst.update, inst.refs);
          parent.removeChild(oldChild);
        }
      } else if (oldChild && newChild) {
        diffElement(oldChild, newChild);
      }
    }
  }
}

/**
 * 同步属性
 * 先删除旧节点有而新节点没有的属性，再更新值不同的属性。
 * input value 特殊处理：保留曾受控或正在受控的 value 双向绑定。
 */
function syncAttributes(oldNode: Element, newNode: Element) {
  // 移除旧节点独有的属性
  Array.from(oldNode.attributes).forEach(attr => {
    if (!newNode.hasAttribute(attr.name)) oldNode.removeAttribute(attr.name);
  });
  // 新增或更新值变化的属性
  Array.from(newNode.attributes).forEach(attr => {
    if (oldNode.getAttribute(attr.name) !== attr.value) oldNode.setAttribute(attr.name, attr.value);
  });
  // input value 特殊处理：保持 DOM 值与受控状态一致
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

/**
 * 同步事件监听
 * 比较新旧 _listeners 对象，移除旧有但新没有的，新增旧没有的。
 * 监听器存储为 _listeners 以便 diff 时做引用比较，避免重复绑定。
 */
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

/**
 * 同步 style
 * 直接比较 cssText 字符串，整体替换。避免逐个 style 属性比较的复杂度。
 */
function syncStyles(oldNode: Element, newNode: Element) {
  const oldStyle = (oldNode as HTMLElement | SVGElement).style;
  const newStyle = (newNode as HTMLElement | SVGElement).style;
  if (oldStyle.cssText !== newStyle.cssText) {
    oldStyle.cssText = newStyle.cssText;
  }
}

/**
 * 子节点协调（keyed reconciliation）
 * 用 Map<key, Node> 建立旧子节点索引，遍历新子节点按 key 匹配。
 * 匹配到则 diff 更新并保留 DOM 状态（如 input 输入内容）；
 * 未匹配的新节点插入，残余旧节点移除。
 * 无 key 时降级为按索引一一比对。
 */
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
        const inst = (child as any)._componentInstance;
        if (inst) _unsubscribeComponent?.(inst.update, inst.refs);
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
        const inst = (oc as any)._componentInstance;
        if (inst) _unsubscribeComponent?.(inst.update, inst.refs);
        parent.removeChild(oc);
      } else if (oc && nc) {
        diffElement(oc, nc);
      }
    }
  }
}

/**
 * 统一 DOM Diff 入口
 *
 * 步骤：
 * 1. 节点类型不同 → 直接替换
 * 2. 文本节点 → 只更新 textContent
 * 3. 组件边界拦截 → 同组件只同步根属性，内部由组件自己的 updateFn 管理
 * 4. 普通元素 → syncAttributes → syncStyles → syncListeners → reconcileChildren
 */
export function diffElement(oldNode: Node, newNode: Node): Node {
  // 1. 节点类型不同 → 直接替换（清理旧组件的订阅）
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
    const inst = (oldNode as any)._componentInstance;
    if (inst) _unsubscribeComponent?.(inst.update, inst.refs);
    oldNode.parentNode?.replaceChild(newNode, oldNode);
    return newNode;
  }

  // 2. 文本节点 → 更新内容
  if (oldNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent) {
      oldNode.textContent = newNode.textContent;
    }
    return oldNode;
  }

  // 3. 组件边界 & 普通元素
  const isOldStyled = oldNode instanceof HTMLElement || oldNode instanceof SVGElement;
  const isNewStyled = newNode instanceof HTMLElement || newNode instanceof SVGElement;
  if (isOldStyled && isNewStyled) {
    // 组件边界：跳过深 diff，由组件自己的 componentUpdateFn 管理内部更新
    if ((oldNode as any)._componentInstance && (newNode as any)._componentInstance) {
      const oldInstance = (oldNode as any)._componentInstance;
      const newInstance = (newNode as any)._componentInstance;
      // 组件不同（路由切换等）→ 完全替换（清理旧组件订阅）
      if (oldInstance.setupFn !== newInstance.setupFn) {
        // 若存在被覆盖的子组件实例，清理子组件的订阅而非父组件
        const target = oldInstance._childComponent || oldInstance;
        _unsubscribeComponent?.(target.update, target.refs);
        oldNode.parentNode?.replaceChild(newNode, oldNode);
        return newNode;
      }
      // 同一组件：更新 props，同时清理被丢弃新实例及其子组件的订阅
      oldInstance.props = newInstance.props;
      if (newInstance.refs.size > 0) {
        _unsubscribeComponent?.(newInstance.update, newInstance.refs);
      }
      if (newInstance._childComponent?.refs.size > 0) {
        _unsubscribeComponent?.(newInstance._childComponent.update, newInstance._childComponent.refs);
      }
      // 直接模式（setupFn === renderFn）：用新 props 重新执行并 diff
      if (oldInstance.setupFn === oldInstance.renderFn) {
        const newDom = oldInstance.setupFn(oldInstance.props);
        return diffElement(oldNode, newDom as Node);
      }
      // Setup 模式：仅同步根元素属性，内部更新由 componentUpdateFn 触发
      syncAttributes(oldNode, newNode);
      syncStyles(oldNode, newNode);
      syncListeners(oldNode, newNode);
      return oldNode;
    }

    // 普通元素：同步属性 + 递归子节点
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
