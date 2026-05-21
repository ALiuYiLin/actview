import { getCurrentInstance } from "../hooks";
import { Ref } from "../types";

/**
 * 发布订阅中心 — 响应式系统的核心
 *
 * 当 ref/reactive 数据在 currentUpdateFn 作用域内被读取时，自动将该 ref
 * 与当前的 updateFn 绑定。数据变化时，publish 触发所有已绑定的回调。
 */
export class EventBus {
  /** ref → 依赖它的回调集合 */
  private subscribers = new Map<Ref<any>, Set<()=>void>>();
  /** 回调 → 它订阅的 ref 集合（用于取消订阅时反向查找） */
  private callbackRefs = new Map<()=>void, Set<Ref<any>>>();
  /** 正在发布中的 ref 集合（防止循环调用栈溢出） */
  private publishing = new Set<Ref<any>>();

  /**
   * 将回调注册到 ref 上，同时双向记录以便后续取消
   * 调用时机：ref getter 中，且当前存在 currentUpdateFn
   */
  subscribe(ref: Ref<any>, callback: () => void) {
    if (!this.subscribers.has(ref)) this.subscribers.set(ref, new Set());
    this.subscribers.get(ref)?.add(callback);
    // 追踪当前组件实例的 ref 订阅，用于组件卸载时取消订阅
    const inst = getCurrentInstance();
    if (inst) inst.refs.add(ref);
  }

  /**
   * 取消指定回调的所有订阅
   * 通过 callbackRefs 找到该回调注册过的所有 ref，逐一移除
   */
  unsubscribe(callback: () => void) {
    const refs = this.callbackRefs.get(callback);
    if (refs) {
      for (const ref of refs) this.subscribers.get(ref)?.delete(callback);
      this.callbackRefs.delete(callback);
    }
  }

  /**
   * 通知所有关注该 ref 的回调
   * 使用 publishing 集合防止同一 ref 的递归发布导致栈溢出
   */
  publish(ref: Ref<any>) {
    if (this.publishing.has(ref)) return;
    this.publishing.add(ref);
    const callbacks = this.subscribers.get(ref);
    if (callbacks) {
      // 快照遍历，防止发布过程中 subscribers 被修改
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
