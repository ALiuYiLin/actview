export class EventBus {
  /** ref → 依赖它的回调集合 */
  private subscribers = new Map<Object, Set<()=>void>>();

  subscribe(obj: Object, callback: () => void) {
    if (!this.subscribers.has(obj)) this.subscribers.set(obj, new Set());
    this.subscribers.get(obj)?.add(callback);
  }

  publish(obj: Object){
    const callbacks = this.subscribers.get(obj);
    if (callbacks) {
      // 快照遍历，防止发布过程中 subscribers 被修改
      [...callbacks].forEach(cb => {
        if (this.subscribers.get(obj)?.has(cb)) cb();
      });
    }
  }
}

export const eventBus = new EventBus()