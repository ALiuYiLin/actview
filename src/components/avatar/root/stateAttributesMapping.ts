// 移植自 base-ui avatar/root/stateAttributesMapping.ts
// imageLoadingStatus 映射为 null：不产出 data-image-loading-status 属性
// （加载状态只通过 context/state 供 render 函数消费，不进 DOM）
export const avatarStateAttributesMapping = {
  imageLoadingStatus: () => null,
};
