import { Ref } from "../types";

export class EventBus {
  private subscribers = new Map<Ref<any>, Set<()=>void>>();
  private callbackRefs = new Map<()=>void, Set<Ref<any>>>();
  private publishing = new Set<Ref<any>>();

  subscribe(ref: Ref<any>, callback: () => void) {
    if (!this.subscribers.has(ref)) this.subscribers.set(ref, new Set());
    this.subscribers.get(ref)?.add(callback);
    if (!this.callbackRefs.has(callback)) this.callbackRefs.set(callback, new Set());
    this.callbackRefs.get(callback)?.add(ref);
  }

  unsubscribe(callback: () => void) {
    const refs = this.callbackRefs.get(callback);
    if (refs) {
      for (const ref of refs) this.subscribers.get(ref)?.delete(callback);
      this.callbackRefs.delete(callback);
    }
  }

  publish(ref: Ref<any>) {
    if (this.publishing.has(ref)) return;
    this.publishing.add(ref);
    const callbacks = this.subscribers.get(ref);
    if (callbacks) {
      [...callbacks].forEach(cb => {
        if (this.subscribers.get(ref)?.has(cb)) cb();
      });
    }
    this.publishing.delete(ref);
  }
}

export const eventBus = new EventBus();

setInterval(() => {
  let total = 0;
  for (const set of eventBus['subscribers'].values()) total += set.size;
  console.log(`[EventBus] 订阅总数: ${total}`);
}, 1000);
