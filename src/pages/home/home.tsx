import { reactive } from '@actview/core';
import './index.css'

export function Home() {
  // ========== Setup 阶段（只执行一次）==========
  let nextId = 4
  const studentList = reactive([
    { id: 1, name: '张三', age: 18 },
    { id: 2, name: '李四', age: 20 },
    { id: 3, name: '王五', age: 22 },
  ])

  const names = ['赵六', '孙七', '周八', '吴九', '郑十', '冯十一', '陈十二']

  function randomName() {
    return names[Math.floor(Math.random() * names.length)]
  }

  function randomAge() {
    return Math.floor(Math.random() * 12) + 18
  }

  // ========== 返回 render 函数（每次更新重新执行）==========
  return () => (
    <div class="container">
      <h1>列表渲染 Demo</h1>
      <div class="tip-box">
        <strong>复现步骤：</strong>在下方输入框中随意输入内容，然后点击「头部添加」或「随机排序」，
        观察输入框中的内容是否跟随数据行正确移动。
      </div>
      <div class="action-bar">
        <button onClick={() => studentList.push({ id: nextId++, name: randomName(), age: randomAge() })}>
          尾部添加
        </button>
        <button onClick={() => studentList.unshift({ id: nextId++, name: randomName(), age: randomAge() })}>
          头部添加
        </button>
        <button onClick={() => { if (studentList.length) studentList.pop() }}>
          尾部删除
        </button>
        <button onClick={() => { if (studentList.length) studentList.shift() }}>
          头部删除
        </button>
        <button onClick={() => studentList.sort(() => Math.random() - 0.5)}>
          随机排序
        </button>
        <button onClick={() => studentList.splice(0, studentList.length)}>
          清空
        </button>
      </div>
      <div class="list-info">共 {`${studentList.length}`} 条数据</div>
      <table class="student-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>年龄</th>
            <th>备注（input 状态）</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {studentList.map((student, index) => (
            <tr key={student.id}>
              <td>{`${student.id}`}</td>
              <td>{student.name}</td>
              <td>{`${student.age}`}</td>
              <td><input class="remark-input" placeholder={`给 ${student.name} 写备注`} /></td>
              <td>
                <button class="btn-sm btn-danger" onClick={() => studentList.splice(index, 1)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {studentList.length === 0 ? <p class="empty-tip">暂无数据，请点击添加按钮</p> : null}
    </div>
  );
}
