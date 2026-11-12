import {
  ActViewComponent,
  Component,
  Mounted,
  Prop,
  Ref,
  Setup,
  Unmounted,
} from "@actview/core";

/**
 * 第一版类组件目标形态示例。
 *
 * - @Component 强制标记为组件（必须实现 render）
 * - @Prop 映射父组件传入的 props（initializer 作为缺省值）
 * - @Ref 让 this.count 等价于 count.value（渲染器安装 accessor）
 * - @Setup 在实例创建后、首帧前执行一次
 * - @Mounted / @Unmounted 挂载 / 卸载时执行
 */
@Component({ name: "Counter" })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop
  initial = 1;

  @Ref
  count = 0;

  @Setup
  setup(): void {
    this.count = this.initial;
  }

  @Mounted
  mounted(): void {
    console.log("[actview] Counter mounted");
  }

  @Unmounted
  unmounted(): void {
    console.log("[actview] Counter unmounted");
  }

  render() {
    return (
      <button
        onClick={() => {
          this.count++;
        }}
      >
        点击+1：{this.count}
      </button>
    );
  }
}

@Component({ name: "App" })
export class App extends ActViewComponent {
  render() {
    return (
      <main>
        <Counter initial={1} />
      </main>
    );
  }
}
