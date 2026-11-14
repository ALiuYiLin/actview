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
  Watch,
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
        class="rounded-xl bg-indigo-600 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500 active:scale-95"
        onClick={() => {
          this.data.increment();
        }}
      >
        点击+1：{this.data.count} / double：{this.data.double}
      </button>
    );
  }
}



@Model
class MyInput {
  @Ref text!: string


  onChange(str: string){
    this.text = str
  }


  @Watch('text')
  w(value: string, oldValue: string){
    console.log('oldValue: ', oldValue);
    console.log('value: ', value)
  }
}


@Component({ name: "Login" })
export class Login extends ActViewComponent {
  @UseModel(MyInput)
  userName!: MyInput

  render() {
    return (
      <div>
        <input
          type="text"
          class="w-72 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          placeholder="Type something..."
          value={this.userName.text}
          onInput={(e) => this.userName.onChange(e.target.value)}
        />
      </div>
    );
  }
}


@Component({ name: "App" })
export class App extends ActViewComponent {
  render() {
    return (
      <main class="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 p-8 text-slate-100">
        <Counter initial={1} />
        <Login></Login>
      </main>
    );
  }
}
