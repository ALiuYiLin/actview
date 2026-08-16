---
'@actview/core': patch
---

修复：SVG 元素设置 class/className 时在真实浏览器抛 `TypeError: Cannot set property className of #<SVGElement> which has only a getter`（SVGElement.prototype.className 为只读 SVGAnimatedString），改为对 SVG 元素走 `setAttribute('class', ...)`；HTML 元素仍走 `className` 属性赋值。
