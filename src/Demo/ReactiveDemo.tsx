import { reactive, ref } from "actview"

export function ReactiveDemo() {
  const user = reactive({ name: 'Alice', age: 25 })
  const todoItems = ref<string[]>(['Learn Actview', 'Write demos'])

  function addTodo() {
    todoItems.value = [...todoItems.value, `Todo #${todoItems.value.length + 1}`]
  }

  function changeName() {
    user.name = user.name === 'Alice' ? 'Bob' : 'Alice'
  }

  function ageUp() {
    user.age += 1
  }

  return () => (
    <div>
      <h2>reactive 对象</h2>

      <section style="margin-bottom:16px;padding:12px;border:1px solid #ccc">
        <h3>用户信息（reactive）</h3>
        <p>name: <b>{user.name}</b></p>
        <p>age:  <b>{user.age}</b></p>
        <button onClick={changeName}>切换名字</button>
        <button onClick={ageUp}>年龄 +1</button>
      </section>

      <section style="padding:12px;border:1px solid #ccc">
        <h3>待办列表（ref + 数组）</h3>
        <ul>
          {todoItems.value.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <button onClick={addTodo}>添加待办</button>
      </section>
    </div>
  )
}
