import "./FallthroughPage.css?scoped";
import { FallthroughChild } from "./FallthroughChild";

// ============================================================
// ⑫ 显式透传（{...props}，React 语义，无自动 fallthrough）
//   - 案例 1：显式 {...rest} 透传 + class 手动拼接
//   - 案例 2：scoped 跨文件继承（data-v-* 经 {...props} 落到子根）
// ============================================================

// --- 案例 1：显式透传（class 手动拼接，其余 {...rest} 透传） ---
function Panel({ class: cls, children, ...rest }: any) {
  return (
    <div class={["panel-demo", cls].filter(Boolean).join(" ")} {...rest}>
      <b>Panel</b>
      <div class="panel-body">{children}</div>
    </div>
  );
}

export function FallthroughPage() {
  return (
    <div class="demo-card">
      <h2>⑫ 显式透传（{"{...props}"}）</h2>

      <h3>案例 1：显式 {"{...rest}"} 透传 + class 手动拼接</h3>
      <Panel class="p-extra" title="面板提示" data-tag="demo">
        内容（children 正常渲染）
      </Panel>
      <p class="hint">
        根元素实际属性：class="panel-demo p-extra"、title="面板提示"、data-tag="demo"
      </p>

      <h3>案例 2：scoped 跨文件继承（data-v-* 经 {"{...props}"}）</h3>
      <FallthroughChild class="child-skin" />
      <p class="hint">
        .child-skin 定义在本文件 scoped CSS；FallthroughChild 定义在独立文件
        （FallthroughChild.tsx，不 scoped）——其根元素经显式 {"{...props}"} 透传
        继承本文件 data-v-hash → .child-skin[data-v-本文件] 命中
      </p>
    </div>
  );
}
