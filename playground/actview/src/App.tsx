import {
  ActViewComponent,
  Component,
  Computed,
  Model,
  Mounted,
  Prop,
  Ref,
  Setup,
  Unmounted,
  UseModel,
} from "actview";

/**
 * 组件内数据层示例（@Model + @UseModel）。
 *
 * - @Model：per-component 单实例，不参与 render；
 * - @UseModel(Token)：显式注入 Model；
 * - Model 与组件复用同一套生命周期装饰器。
 */
@Model
class CounterData {
  @Ref
  count = 0;

  @Computed
  get double(): number {
    return this.count * 2;
  }

  @Setup
  setup(): void {
    console.log("[actview] CounterData setup");
  }

  @Mounted
  mounted(): void {
    console.log("[actview] CounterData mounted");
  }

  @Unmounted
  unmounted(): void {
    console.log("[actview] CounterData unmounted");
  }

  increment(): void {
    this.count++;
  }
}

@Component({ name: "Counter" })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop
  initial = 1;

  @UseModel(CounterData)
  data!: CounterData;

  @Setup
  setup(): void {
    this.data.count = this.initial;
  }

  render() {
    return (
      <button
        onClick={() => {
          this.data.increment();
        }}
      >
        点击+1：{this.data.count} / double：{this.data.double}
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
