/**
 * LifecycleDemo 组件 — 演示生命周期钩子
 *
 * 学习要点:
 *   - onCreated()    组件创建时触发
 *   - onMounted()    组件挂载到 DOM 后触发
 *   - onBeforeUnmount() 组件卸载前触发
 *   - 条件渲染控制子组件的挂载/卸载
 */
import { ref, onCreated, onMounted, onBeforeUnmount } from "@actview/core";

export function LifecycleDemo() {
  const showChild = ref(true);
  const logLines = ref<string[]>([]);

  const addLog = (msg: string) => {
    logLines.value = [...logLines.value, `[${getTime()}] ${msg}`];
  };

  onCreated(() => {
    addLog("LifecycleDemo 组件创建 (onCreated)");
    console.log("[LifecycleDemo] onCreated");
  });

  onMounted(() => {
    addLog("LifecycleDemo 组件挂载 (onMounted)");
    console.log("[LifecycleDemo] onMounted");
  });

  onBeforeUnmount(() => {
    addLog("LifecycleDemo 组件卸载 (onBeforeUnmount)");
    console.log("[LifecycleDemo] onBeforeUnmount");
  });

  return () => (
    <div class="page lifecycle-page">
      <h2>🔄 生命周期</h2>
      <p class="description">
        演示 <code>onCreated</code>、<code>onMounted</code>、
        <code>onBeforeUnmount</code> 生命周期钩子。
      </p>

      <div class="demo-card">
        {/* 控制子组件的显示/隐藏 */}
        <div class="control-row">
          <button
            class="btn btn-warning"
            onClick={() => (showChild.value = !showChild.value)}
          >
            {showChild.value ? "卸载子组件" : "挂载子组件"}
          </button>
        </div>

        {/* 条件渲染子组件 */}
        {showChild.value && <ChildComponent addLog={addLog} />}

        {/* 日志输出 */}
        <div class="log-output">
          <h4>📝 日志</h4>
          <div class="log-list">
            {logLines.value.length === 0 ? (
              <span class="log-empty">暂无日志...</span>
            ) : (
              logLines.value.map((line, i) => (
                <div key={i} class="log-line">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 子组件 — 演示子组件的生命周期
 */
function ChildComponent({ addLog }: { addLog: (msg: string) => void }) {
  const elapsed = ref(0);

  let timer: ReturnType<typeof setInterval> | null = null;

  onCreated(() => {
    addLog("子组件创建 (onCreated)");
  });

  onMounted((ins) => {
    console.log('ins: ', ins);
    addLog("子组件挂载 (onMounted)");
    let seconds = 0;
    timer = setInterval(() => {
      seconds++;
      elapsed.value = seconds;
      if (seconds % 5 === 0) {
        addLog(`子组件已挂载 ${seconds} 秒`);
      }
    }, 1000);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    addLog("子组件卸载 (onBeforeUnmount)");
  });

  return () => (
    <div class="child-component">
      <h4>🧒 子组件</h4>
      <p>已挂载：{elapsed.value} 秒</p>
    </div>
  );
}

// 获取当前时间字符串 (HH:mm:ss)
function getTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
