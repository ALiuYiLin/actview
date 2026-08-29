---
'@actview/core': patch
---

fix(core): input value 渲染 attribute（对齐 SSR/React 契约）

客户端 setProp 对 INPUT 的 value 只设置 property（el.value），不渲染
attribute——SSR 端 serializeAttrs 经 resolveAttr 的 enumerated 分支已输出
value 属性（如 `<input value="50">`），客户端却只有 property（getAttribute
返回 null），双端不一致；React 对受控/非受控 input 都渲染 value attribute。

影响：Slider.Thumb 等隐藏 input 的滑块值未渲染进 HTML（golden：React 参考
输出 value="30"/"70"）。

修复：setProp 的 value 分支对 INPUT 补 `setAttribute('value', String(value))`；
SELECT 保持（value → option selected）、TEXTAREA 保持（React 语义：value 走
children，不输出 attribute）。

回归用例：base-ui actview SliderThumb.test 隐藏 input 的 value attribute +
aria-valuenow/aria-valuetext。
