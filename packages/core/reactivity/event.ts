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
  /** 正在发布中的 ref 集合（防止循环调用栈溢出） */
  private publishing = new Set<Ref<any>>();

  /**
   * 将回调注册到 ref 上
   * 调用时机：ref getter 中，且当前存在 currentUpdateFn
   * 同时将 ref 记录到当前组件实例的 refs 集合，用于卸载时取消订阅
   */
  subscribe(ref: Ref<any>, callback: () => void) {
    if (!this.subscribers.has(ref)) this.subscribers.set(ref, new Set());
    this.subscribers.get(ref)?.add(callback);
    const inst = getCurrentInstance();
    if (inst) inst.refs.add(ref);
  }

  /**
   * 取消指定回调在指定 refs 上的订阅
   * 只移除该回调，保留其他组件对同一 ref 的订阅
   */
  unsubscribe(callback: () => void, refs: Set<Ref<any>>) {
    for (const ref of refs) {
      const set = this.subscribers.get(ref);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.subscribers.delete(ref);
      }
    }
  }

  /**
   * 通知所有关注该 ref 的回调
   * 使用 publishing 集合防止同一 ref 的递归发布导致栈溢出
   */
  publish(ref: Ref<any>) {
    console.log('this.subscribers: ', this.subscribers);
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
