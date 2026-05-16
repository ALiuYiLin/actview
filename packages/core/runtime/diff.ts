
/**
 * 简单的 DOM Diff 算法
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

  // 3. 元素节点处理
  if (oldNode instanceof HTMLElement && newNode instanceof HTMLElement) {
    // 如果旧节点是组件根元素，由组件的 updateFn 管理子节点更新
    // 此处只同步根元素的属性，不递归子节点
    if ((oldNode as any)._componentInstance) {
      // 当新节点也是组件根元素且组件函数不同时 → 路由切换等场景
      // 需要完全替换旧节点，而不是保留旧组件实例
      const newInstance = (newNode as any)._componentInstance;
      if (newInstance) {
        const oldInstance = (oldNode as any)._componentInstance;
        if (oldInstance.setupFn !== newInstance.setupFn) {
          oldNode.parentNode?.replaceChild(newNode, oldNode);
          return newNode;
        }
        // 同一组件：只同步 props
        oldInstance.props = newInstance.props;
      }
      updateAttributes(oldNode, newNode);
      updateListeners(oldNode, newNode);
      return oldNode;
    }

    // 3.1 更新属性
    updateAttributes(oldNode, newNode);

    // 3.2 更新事件监听器
    updateListeners(oldNode, newNode);

    // 3.3 更新子节点
    updateChildren(oldNode, newNode);
    
    return oldNode;
  }
  
  // DocumentFragment 处理（简单策略：直接把新内容插进去，不做精细 diff）
  if (oldNode instanceof DocumentFragment || newNode instanceof DocumentFragment) {
     // Fragment 比较特殊，插入后就消失了，这里无法复用 oldNode
     // 简单策略：如果父节点存在，用新 Fragment 替换旧位置的所有内容
     // 但由于 Fragment 插入后不可追踪，这里我们假设 compile.ts 里的用法场景：
     // 如果上次是 Fragment，这次也是 Fragment，我们很难直接 diff 它们（因为 Fragment 自身不留在 DOM 树上）
     // 所以对于 Fragment，建议在 compile 层直接全量替换，或者 diff 算法只处理 Element/Text
     return newNode;
  }

  return oldNode;
}

function updateAttributes(oldNode: HTMLElement, newNode: HTMLElement) {
  // 移除旧属性
  Array.from(oldNode.attributes).forEach(attr => {
    if (!newNode.hasAttribute(attr.name)) {
      oldNode.removeAttribute(attr.name);
    }
  });

  // 设置新属性
  Array.from(newNode.attributes).forEach(attr => {
    if (oldNode.getAttribute(attr.name) !== attr.value) {
      oldNode.setAttribute(attr.name, attr.value);
    }
  });
  
  // 特殊处理 value (input/textarea)
  // 只有当新节点显式设置了 value 属性（attribute）或者新节点的 value 属性（property）与默认空值不同时，才去同步 property
  // 这样可以避免“非受控组件”的用户输入被意外清空
  // 但对于受控组件（render 里 value={state}），如果 state 没变（render 出的 value 还是旧的），
  // 这里也会把用户输入重置回旧 state（符合 React 受控组件行为）。
  if ('value' in newNode && 'value' in oldNode) {
    const newValue = (newNode as any).value;
    const oldValue = (oldNode as any).value;
    
    // 只有当新值确实不同，且新节点似乎是有意设置了值时才更新
    // 简单的判断：如果新节点的 value 和它的 defaultValue (即 attribute) 一致，
    // 或者新节点有 value attribute，我们才认为它是受控的或者有明确初值的。
    // 如果新节点完全没设 value（attribute 是 null，property 是空串），可能是个“无辜”的非受控节点，
    // 这时如果旧节点有用户输入（oldValue != ""），我们尽量保留它。
    
    const hasValueAttr = newNode.hasAttribute('value');
    if (newValue !== oldValue) {
      // 如果新节点有显式的 value 属性，或者新节点的 value 属性不为空，强制同步
      if (hasValueAttr || newValue !== '') {
        (oldNode as any).value = newValue;
      }
    }
  }
}

function updateListeners(oldNode: HTMLElement, newNode: HTMLElement) {
  const oldListeners = (oldNode as any)._listeners || {};
  const newListeners = (newNode as any)._listeners || {};

  // 移除旧的不再存在的或已改变的
  for (const [name, listener] of Object.entries(oldListeners)) {
    if (!newListeners[name] || newListeners[name] !== listener) {
      oldNode.removeEventListener(name, listener as EventListener);
      delete oldListeners[name];
    }
  }

  // 添加新的
  for (const [name, listener] of Object.entries(newListeners)) {
    if (!oldListeners[name]) {
      oldNode.addEventListener(name, listener as EventListener);
      oldListeners[name] = listener;
    }
  }
  
  (oldNode as any)._listeners = oldListeners;
}

function getKey(node: Node): any {
  return (node as any)._key;
}

function hasKeyedChildren(children: Node[]): boolean {
  return children.length > 0 && children.some(c => getKey(c) !== undefined);
}

function updateChildren(oldParent: HTMLElement, newParent: HTMLElement) {
  const oldChildren = Array.from(oldParent.childNodes);
  const newChildren = Array.from(newParent.childNodes);

  // 如果新子节点带 key，走 keyed diff
  if (hasKeyedChildren(newChildren)) {
    patchKeyedChildren(oldParent, oldChildren, newChildren);
    return;
  }

  // 无 key，原有 index-based diff
  const maxLength = Math.max(oldChildren.length, newChildren.length);
  for (let i = 0; i < maxLength; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];

    if (!oldChild && newChild) {
      oldParent.appendChild(newChild);
    } else if (oldChild && !newChild) {
      oldParent.removeChild(oldChild);
    } else if (oldChild && newChild) {
      diff(oldChild, newChild);
    }
  }
}

/**
 * Keyed children diff
 * 通过 key 映射旧节点，对于匹配到的旧节点做 diff 复用，未匹配的新增，多余的删除
 * 最后根据新序列的顺序调整 DOM 位置
 * @param anchor 可选锚点节点（Fragment 模式下传 endAnchor，新节点插入到 anchor 之前）
 */
function patchKeyedChildren(parent: Node, oldChildren: Node[], newChildren: Node[], anchor?: Node | null) {
  // 建立旧 key -> node 映射
  const oldKeyMap = new Map<any, Node>();
  for (const child of oldChildren) {
    const key = getKey(child);
    if (key !== undefined) {
      oldKeyMap.set(key, child);
    }
  }

  // 用于跟踪本轮保留的节点
  const handledOldNodes = new Set<Node>();
  // 生成结果节点列表（复用旧节点或使用新节点）
  const resultNodes: Node[] = [];

  for (const newChild of newChildren) {
    const key = getKey(newChild);
    const oldChild = key !== undefined ? oldKeyMap.get(key) : undefined;

    if (oldChild) {
      // 匹配到旧节点 —— diff 更新属性/子节点，复用旧 DOM
      diff(oldChild, newChild);
      resultNodes.push(oldChild);
      handledOldNodes.add(oldChild);
    } else {
      // 新节点，直接使用
      resultNodes.push(newChild);
    }
  }

  // 删除不再出现的旧节点
  for (const child of oldChildren) {
    if (!handledOldNodes.has(child)) {
      parent.removeChild(child);
    }
  }

  // 按新顺序调整 DOM 位置（从后往前，用 anchor 或 null 作为参考点）
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

export { patchKeyedChildren, getKey, hasKeyedChildren };