// ============================================================
// TS 类型回归测试（仅 tsc 检查，运行时不使用 / 不被打包）
//   验证：SVG 元素类型、ARIA 属性、data-* 属性、完整事件、
//         组件 props 严格化（LibraryManagedAttributes）
//   下方用「ts-expect-error」指令标注「应当报错」的用例 ——
//   若类型系统退化，这些行会变成「未使用的指令」而被 tsc 报出。
// ============================================================

// SVG 元素类型（viewBox / circle 专属属性 cx/cy/r/fill）
const svg = (
  <svg viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="40" fill="red" />
    <path d="M0 0 L100 100" stroke="blue" />
  </svg>
)

// ARIA 属性（aria-* 模板索引签名）
const aria = (
  <div aria-label="提示" aria-hidden={true} aria-expanded="false" />
)

// data-* 属性
const data = <div data-testid="box" data-count={1} data-ok="yes" />

// 完整事件（pointer / animation / transition / clipboard / wheel 等）
const events = (
  <div
    onPointerDown={() => {}}
    onAnimationEnd={() => {}}
    onTransitionEnd={() => {}}
    onCopy={() => {}}
    onWheel={() => {}}
    onClickCapture={() => {}}
  />
)

// 组件 props 严格化：声明类型必填 + 自定义属性报错
function Strict(props: { name: string }) {
  return <div>{props.name}</div>
}

// @ts-expect-error - 缺少必填 props.name
const missingName = <Strict />

// @ts-expect-error - 未声明的自定义 prop（严格化：非 HTML 属性报错）
const extraProp = <Strict name="x" foo="bar" />

// 合法：声明 + HTML 属性（class/style/事件 允许透传）
const ok = <Strict name="x" class="btn" onClick={() => {}} />

// 保持引用，避免 noUnusedLocals 报错（声明即用）
export const __typesCheck = [svg, aria, data, events, missingName, extraProp, ok]
