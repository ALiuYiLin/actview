// ============================================================
// 测试用空页面
// ============================================================

export function TestPage() {
  return <div class="demo-card">test<Child vp={'aaaa'}></Child></div>;
}

function Child(props: { vp?: string }, ctx?: any) {
  console.log('ctx: ', ctx);
  return <div>child {props.vp}</div>
} 