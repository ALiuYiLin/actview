import { Ref } from "../types";

export class EventBus {
  private subscribers = new Map<Ref<any>, Set<()=>void>>();
  /** 防止 publish 重入的标记 */
  private publishing = new Set<Ref<any>>();

  // 订阅
  subscribe(ref: Ref<any>, callback: () => void) {
    if (!this.subscribers.has(ref)) {
      this.subscribers.set(ref, new Set());
    }
    this.subscribers.get(ref)?.add(callback);
  }

  // 发布
  publish(ref: Ref<any>){
    // 防止同一个 ref 的重入（避免发布链中的无限循环）
    if (this.publishing.has(ref)) return;
    this.publishing.add(ref);
    const callbacks = this.subscribers.get(ref);
    if(callbacks) {
      // 拷贝一份，避免循环中新增的订阅被意外调用
      [...callbacks].forEach(cb=>cb())
    }
    this.publishing.delete(ref);
  }
}

export const eventBus = new EventBus();