import { useState } from 'react'
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  Check,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card } from '../components/ui/Card'
import { Modal, Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { courseColorMap, clsx } from '../lib/format'

const COLORS = ['purple', 'blue', 'orange', 'green', 'pink']
const colorLabel = { purple: '浅紫', blue: '浅蓝', orange: '浅橙', green: '浅绿', pink: '粉色' }

export function Courses() {
  const { data, addCourse, updateCourse, deleteCourse, addNote, deleteNote } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', teacher: '', color: 'purple', progress: 0 })
  const [noteDraft, setNoteDraft] = useState({})

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', teacher: '', color: 'purple', progress: 0 })
    setOpen(true)
  }
  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, teacher: c.teacher || '', color: c.color || 'purple', progress: c.progress || 0 })
    setOpen(true)
  }
  const save = () => {
    if (!form.name.trim()) return
    const payload = { ...form, progress: Number(form.progress) || 0 }
    if (editing) updateCourse(editing.id, payload)
    else addCourse(payload)
    setOpen(false)
  }
  const onDelete = (c) => {
    if (window.confirm(`确定删除课程「${c.name}」吗？课程下的笔记也会一并删除。`)) deleteCourse(c.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">共 {data.courses.length} 门课程 · 拖动进度条更新学习进度，随时记笔记</p>
        <Button onClick={openAdd}><Plus size={16} /> 新增课程</Button>
      </div>

      {data.courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="还没有课程"
            description="添加你的第一门课程，开始记录学习进度和笔记"
            accent="purple"
            action={<Button onClick={openAdd}><Plus size={16} /> 新增课程</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.courses.map((c) => {
            const col = courseColorMap[c.color] || courseColorMap.purple
            return (
              <Card key={c.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className={clsx('flex h-11 w-11 items-center justify-center rounded-2xl', col.chip)}>
                    <GraduationCap size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.teacher ? `任课：${c.teacher}` : '未填写老师'}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" aria-label="编辑课程">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(c)} className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="删除课程">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">学习进度</span>
                    <span className="font-semibold text-slate-600">{c.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={c.progress}
                    onChange={(e) => updateCourse(c.id, { progress: Number(e.target.value) })}
                    className="w-full accent-brand-500"
                  />
                </div>

                {/* Notes */}
                <div className="mt-4 flex-1 rounded-2xl bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <StickyNote size={14} /> 课程笔记（{c.notes.length}）
                  </div>
                  {c.notes.length === 0 ? (
                    <p className="py-2 text-center text-xs text-slate-300">还没有笔记</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.notes.map((n) => (
                        <li key={n.id} className="group flex items-start gap-2 rounded-xl bg-white px-2.5 py-2 text-sm text-slate-600">
                          <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', col.dot)} />
                          <span className="flex-1">{n.content}</span>
                          <button onClick={() => deleteNote(c.id, n.id)} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label="删除笔记">
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      value={noteDraft[c.id] || ''}
                      onChange={(e) => setNoteDraft({ ...noteDraft, [c.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (noteDraft[c.id] || '').trim()) {
                          addNote(c.id, noteDraft[c.id].trim())
                          setNoteDraft({ ...noteDraft, [c.id]: '' })
                        }
                      }}
                      placeholder="记一条笔记，回车保存"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-400"
                    />
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        if ((noteDraft[c.id] || '').trim()) {
                          addNote(c.id, noteDraft[c.id].trim())
                          setNoteDraft({ ...noteDraft, [c.id]: '' })
                        }
                      }}
                    >
                      <Check size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑课程' : '新增课程'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? '保存修改' : '添加'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">课程名称</label>
            <input className="input-base" autoFocus value={form.name} placeholder="例如：高等数学" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label-base">任课老师</label>
            <input className="input-base" value={form.teacher} placeholder="选填" onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">主题色</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={clsx(
                      'h-9 w-9 rounded-xl transition',
                      courseColorMap[c].bar,
                      form.color === c && 'ring-2 ring-offset-2 ring-slate-300',
                    )}
                    title={colorLabel[c]}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="label-base">初始进度（%）</label>
              <input type="number" min="0" max="100" className="input-base" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
