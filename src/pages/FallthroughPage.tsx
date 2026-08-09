import "./FallthroughPage.css?scoped";
import { FallthroughChild } from "./FallthroughChild";

// ============================================================
// ⑫ attribute fallthrough + scoped 跨文件继承
//   - 案例 1：attrs 全量透传（函数形态：class 拼接 + 标量落根）
//   - 案例 2：options 形态 props 白名单分离（声明内 → props，声明外 → ctx.attrs）
//   - 案例 3：scoped 跨文件组件 root 继承父 hash（.child-skin 命中跨文件子根）
// ============================================================

// --- 案例 1：attrs 全量透传（函数形态，props=attrs=全量） ---
function Panel(props: any) {
  return (
    <div class="panel-demo">
      <b>Panel</b>（根元素 class 拼接 + title/data-tag 标量透传）
      <div class="panel-body">{props.children}</div>
    </div>
  );
}

// --- 案例 2：自动 props 提取（TS 类型注解 → Babel 自动生成 options 形态，
//    无需手写 defineComponent；第二参 ctx（可选，读取 attrs）） ---
function Box(props: { label: string }, ctx?: any) {
  return (
    <div class="box-demo" title={ctx.attrs.note}>
      <b>props.label = {props.label}</b>
      <span class="box-note">
        （note 未声明 → 在 ctx.attrs → 透传为根元素 title）
      </span>
    </div>
  );
}

export function FallthroughPage() {
  return (
    <div class="demo-card">
      <h2>⑫ attribute fallthrough + scoped 跨文件继承</h2>

      <h3>案例 1：attrs 全量透传（class 拼接 + 标量落根）</h3>
      <Panel class="p-extra" title="面板提示" data-tag="demo">
        内容（children 正常渲染）
      </Panel>
      <p class="hint">
        根元素实际属性：class="panel-demo p-extra"、title="面板提示"、data-tag="demo"
      </p>

      <h3>案例 2：options 形态 props 白名单分离</h3>
      <Box label="标签-A" note="来自 attrs" />
      <p class="hint">
        label 声明进 setup(props) 显示；note 未声明进 ctx.attrs → 透传为根元素
        title 属性
      </p>

      <h3>案例 3：scoped 跨文件组件 root 继承父 hash</h3>
      <FallthroughChild class="child-skin" />
      <p class="hint">
        .child-skin 定义在本文件 scoped CSS；FallthroughChild 定义在独立文件
        （FallthroughChild.tsx，不 scoped）——其根元素经运行时 fallthrough 继承
        本文件 data-v-hash → .child-skin[data-v-本文件] 命中；
        子内部元素（strong）不带本文件 hash，需 :deep(strong) 才能命中
      </p>
    </div>
  );
}
