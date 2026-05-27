import { ref } from "actview"

interface Student {
  id: number
  name: string
  code: string
}

let nextId = 4

const initial: Student[] = [
  { id: 1, name: 'Alice', code: 'A001' },
  { id: 2, name: 'Bob', code: 'B002' },
  { id: 3, name: 'Charlie', code: 'C003' },
]

function StudentRow(props: { student: Student; onRemove: (id: number) => void }) {
  const { student, onRemove } = props
  // 用于测试 input 输入内容在 re-render 后是否丢失
  const note = ref('')

  return () => (
    <tr>
      <td>{student.id}</td>
      <td>{student.name}</td>
      <td>{student.code}</td>
      <td>
        <input type="text" placeholder="备注" value={note.value}
          onInput={(e: any) => note.value = (e.target as HTMLInputElement).value} />
      </td>
      <td>
        <button onClick={() => onRemove(student.id)}>删除</button>
      </td>
    </tr>
  )
}

export function App() {
  const students = ref<Student[]>([...initial])

  function addFirst() {
    students.value = [{ id: nextId++, name: 'New', code: `N${String(nextId - 1).padStart(3, '0')}` }, ...students.value]
  }

  function addLast() {
    students.value = [...students.value, { id: nextId++, name: 'New', code: `N${String(nextId - 1).padStart(3, '0')}` }]
  }

  function remove(id: number) {
    students.value = students.value.filter(s => s.id !== id)
  }

  function shuffle() {
    const arr = [...students.value]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    students.value = arr
  }

  return () => (
    <div id="app-root">
      <h2>Student List — Key Diff Test</h2>

      <div style="margin-bottom:8px">
        <button onClick={addFirst}>在前面添加</button>
        <button onClick={addLast}>在末尾添加</button>
        <button onClick={shuffle}>随机排序</button>
      </div>

      <table border="1" style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>学号</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {students.value.map(s => (
            <StudentRow key={s.id} student={s} onRemove={remove} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
