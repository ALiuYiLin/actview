// ============================================================
// 独立文件子组件（本文件不 scoped）——验证「父文件 scoped 样式经
// 显式 {...props} 透传命中跨文件组件根元素」（子 root 继承父 scopeId）
// ============================================================

export function FallthroughChild(props: any) {
  return (
    <div class="child-root" {...props}>
      <strong>FallthroughChild</strong>（定义于独立文件 FallthroughChild.tsx）
      <div class="child-desc">
        根元素经显式 {...props} 透传携带父页面的 data-v-hash 与 class="child-skin"，
        因此父文件 scoped 的 .child-skin 规则能命中
      </div>
    </div>
  );
}
