---
'@actview/core': patch
---

fix(core): style patch 清理旧键——新 style 中移除的键清除 DOM 残留

patchProps/setProp 的 style 分支只设置新值、不清理旧值：某键从有值变为
null/undefined/false 时（如 Slider.Thumb 的 z-index 从 2 → undefined），
旧值残留在元素 style 上（golden C5：无交互的双 thumb 多出 z-index:2，
与 React 参考的最终 DOM 不一致）。

修复：
- setProp style 分支：键显式 null/undefined/false 时清除旧值
  （CSS 变量 removeProperty，其余键赋空串）
- patchProps：新 style 中消失的旧键 → 清除 DOM 值

回归用例：base-ui actview 的 SliderThumb.test 双 thumb（center/inset）
无交互时 style 不含 z-index。
