// ============================================================
// 独立文件子组件（本文件不 scoped）——验证「父文件 scoped 样式经
// 运行时 fallthrough 命中跨文件组件根元素」（子 root 继承父 scopeId）
// ============================================================

export function FallthroughChild(_props: any) {
  return (
    <div class="child-root">
      <strong>FallthroughChild</strong>（定义于独立文件 FallthroughChild.tsx）
      <div class="child-desc">
        根元素经运行时 fallthrough 携带父页面的 data-v-hash 与 class="child-skin"，
        因此父文件 scoped 的 .child-skin 规则能命中；
        内部元素（本文件）不带父 hash，需父样式用 :deep() 才能命中。
      </div>
    </div>
  );
}
