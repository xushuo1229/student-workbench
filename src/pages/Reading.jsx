import { useState } from 'react'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Clock,
  FileText,
  Library,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card, CardHeader } from '../components/ui/Card'
import { Modal, Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Timer } from '../components/ui/Timer'
import { todayStr, fmtMinutes, clsx } from '../lib/format'

export function Reading() {
  const { data, addReading, updateReading, deleteReading, pushToast } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ book: '', author: '', pages: 0, gain: '', durationMinutes: 0, date: todayStr() })

  const totalBooks = data.readings.length
  const totalPages = data.readings.reduce((s, r) => s + (Number(r.pages) || 0), 0)
  const totalMins = data.readings.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0)

  const openAdd = (duration = 0) => {
    setEditing(null)
    setForm({ book: '', author: '', pages: 0, gain: '', durationMinutes: duration, date: todayStr() })
    setOpen(true)
  }
  const openEdit = (r) => {
    setEditing(r)
    setForm({ book: r.book, author: r.author || '', pages: r.pages, gain: r.gain || '', durationMinutes: r.durationMinutes, date: r.date })
    setOpen(true)
  }
  const save = () => {
    if (!form.book.trim()) return
    const payload = {
      book: form.book.trim(),
      author: form.author.trim(),
      pages: Number(form.pages) || 0,
      gain: form.gain.trim(),
      durationMinutes: Number(form.durationMinutes) || 0,
      date: form.date,
    }
    if (editing) updateReading(editing.id, payload)
    else addReading(payload)
    setOpen(false)
  }
  const onDelete = (r) => {
    if (window.confirm(`确定删除《${r.book}》的阅读记录吗？`)) deleteReading(r.id)
  }

  // Timer "use this duration" -> open add form prefilled with minutes
  const onTimerUse = (seconds) => {
    const mins = Math.round(seconds / 60)
    openAdd(mins)
    pushToast(`已填入本次阅读时长 ${mins} 分钟`)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Timer accent="blue" onUse={onTimerUse} useLabel="使用本次时长" hint="阅读计时" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat icon={Library} label="已读" value={totalBooks} />
            <MiniStat icon={FileText} label="页数" value={totalPages} />
            <MiniStat icon={Clock} label="时长" value={fmtMinutes(totalMins)} />
          </div>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={BookOpen}
            title="阅读记录"
            subtitle="记录你读过的书与收获"
            accent="blue"
            action={<Button size="sm" onClick={() => openAdd()}><Plus size={14} /> 新增阅读</Button>}
          />
          <div className="px-5 py-4">
            {data.readings.length === 0 ? (
              <EmptyState icon={BookOpen} title="还没有阅读记录" description="读了几页都值得记下来，积少成多" accent="blue" />
            ) : (
              <ul className="space-y-3">
                {data.readings.map((r) => (
                  <li key={r.id} className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:bg-blue-50/50">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-slate-800">《{r.book}》</p>
                          {r.author && <span className="text-xs text-slate-400">· {r.author}</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-600">{r.pages} 页</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">{fmtMinutes(r.durationMinutes)}</span>
                          <span>{r.date}</span>
                        </div>
                        {r.gain && <p className="mt-2 text-sm text-slate-600">💡 {r.gain}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button onClick={() => openEdit(r)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-brand-600" aria-label="编辑">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => onDelete(r)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="删除">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑阅读记录' : '新增阅读记录'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? '保存修改' : '保存记录'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">书名</label>
            <input className="input-base" autoFocus value={form.book} placeholder="例如：被讨厌的勇气" onChange={(e) => setForm({ ...form, book: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">作者</label>
              <input className="input-base" value={form.author} placeholder="选填" onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </div>
            <div>
              <label className="label-base">阅读页数</label>
              <input type="number" min="0" className="input-base" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label-base">阅读时长（分钟）</label>
            <input type="number" min="0" className="input-base" placeholder="阅读时长（分钟），例如 35" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">可使用上方计时器的「使用本次时长」自动填入</p>
          </div>
          <div>
            <label className="label-base">阅读收获</label>
            <textarea className="input-base min-h-[80px] resize-none" value={form.gain} placeholder="一句话记录今天的收获或启发…" onChange={(e) => setForm({ ...form, gain: e.target.value })} />
          </div>
          <div>
            <label className="label-base">日期</label>
            <input type="date" className="input-base" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/85 px-2 py-3 text-center shadow-card">
      <Icon size={16} className="mx-auto text-blue-500" />
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  )
}
