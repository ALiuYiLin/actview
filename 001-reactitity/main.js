// 全局依赖容器：Map<响应式对象, Map<属性名, Set<effect函数>>>
const targetMap = new Map();
// 当前正在执行的活跃 effect，用于依赖收集时建立关联
let activeEffect = null;


function track(target, key) {
  // 无活跃 effect 时无需收集（比如手动读取数据的场景）
  if (!activeEffect) return;

  // 取出该对象对应的属性依赖映射表
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }
  // 取出该属性对应的副作用集合
  let effects = depsMap.get(key);
  if (!effects) {
    effects = new Set();
    depsMap.set(key, effects);
  }
  effects.add(activeEffect);
}


function trigger(target, key) {
  // 取出该对象对应的属性依赖映射表
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  // 只取出该属性对应的副作用集合
  const effects = depsMap.get(key) || new Set();
  // 执行effect 相当于重走组件渲染整套流程
  effects.forEach(effect => effect());
}


function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 读取属性：收集该属性的依赖
      track(target, key);
      // 用 Reflect 保证 this 指向正确的代理对象
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      // 先更新属性值
      const result = Reflect.set(target, key, value, receiver);
      // 更新成功后触发该属性的依赖
      trigger(target, key);
      return result;
    }
  });
}

function runEffect(fn) {
  activeEffect = fn;  // 标记当前活跃 effect
  fn();               // 执行副作用，内部读数据时会触发收集
  activeEffect = null; // 执行完毕清空标记
}

// ==========================================================

const state = reactive({ count: 0 });

// 2. 渲染逻辑：对应 render → Diff → 更新真实 DOM 的完整过程
function componentRender() {
  // 模拟读取数据、生成 VNode、更新页面
  console.log('触发渲染，当前 count：', state.count);
  document.body.innerText = `计数器：${state.count}`;
}

// 3. 组件挂载：将渲染流程作为副作用注册
runEffect(componentRender);

// 4. 数据变更：自动触发重新渲染
setInterval(() => {
  state.count++; 
  // 控制台会再次打印渲染日志，页面内容自动更新
}, 1000);
