import { useState } from 'react'
import {
  Languages,
  Plus,
  Pencil,
  Trash2,
  Clock,
  ListChecks,
  Headphones,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card, CardHeader } from '../components/ui/Card'
import { Modal, Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Timer } from '../components/ui/Timer'
import { todayStr, fmtMinutes, englishTypeColorMap, clsx } from '../lib/format'

const TYPES = ['单词', '听力', '阅读', '口语', '写作', '其他']

export function English() {
  const { data, addEnglish, updateEnglish, deleteEnglish, pushToast } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ type: '单词', content: '', durationMinutes: 0, date: todayStr() })

  const totalItems = data.english.length
  const totalMins = data.english.reduce((s, e) => s + (Number(e.durationMinutes) || 0), 0)
  const byType = TYPES.map((t) => ({
    type: t,
    count: data.english.filter((e) => e.type === t).length,
    mins: data.english.filter((e) => e.type === t).reduce((s, e) => s + (Number(e.durationMinutes) || 0), 0),
  })).filter((x) => x.count > 0)
  const maxMins = Math.max(1, ...byType.map((x) => x.mins))

  const openAdd = (duration = 0) => {
    setEditing(null)
    setForm({ type: '单词', content: '', durationMinutes: duration, date: todayStr() })
    setOpen(true)
  }
  const openEdit = (e) => {
    setEditing(e)
    setForm({ type: e.type, content: e.content, durationMinutes: e.durationMinutes, date: e.date })
    setOpen(true)
  }
  const save = () => {
    if (!form.content.trim()) return
    const payload = {
      type: form.type,
      content: form.content.trim(),
      durationMinutes: Number(form.durationMinutes) || 0,
      date: form.date,
    }
    if (editing) updateEnglish(editing.id, payload)
    else addEnglish(payload)
    setOpen(false)
  }
  const onDelete = (e) => {
    if (window.confirm('确定删除这条英语学习记录吗？')) deleteEnglish(e.id)
  }

  const onTimerUse = (seconds) => {
    const mins = Math.round(seconds / 60)
    openAdd(mins)
    pushToast(`已填入本次学习时长 ${mins} 分钟`)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Timer accent="orange" onUse={onTimerUse} useLabel="使用本次时长" hint="学习计时" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniStat icon={ListChecks} label="学习次数" value={totalItems} />
            <MiniStat icon={Clock} label="累计时长" value={fmtMinutes(totalMins)} />
          </div>
          {byType.length > 0 && (
            <Card className="mt-3 p-4">
              <p className="mb-3 text-xs font-medium text-slate-500">各类型投入时长</p>
              <div className="space-y-2.5">
                {byType.map((x) => (
                  <div key={x.type}>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                      <span>{x.type}</span>
                      <span>{fmtMinutes(x.mins)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${(x.mins / maxMins) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={Languages}
            title="英语学习记录"
            subtitle="单词 / 听力 / 阅读 / 口语 / 写作"
            accent="orange"
            action={<Button size="sm" onClick={() => openAdd()}><Plus size={14} /> 新增学习</Button>}
          />
          <div className="px-5 py-4">
            {data.english.length === 0 ? (
              <EmptyState icon={Languages} title="还没有英语学习记录" description="用计时器专注一会儿，再把时长存进来吧" accent="orange" />
            ) : (
              <ul className="space-y-3">
                {data.english.map((e) => (
                  <li key={e.id} className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:bg-orange-50/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                      <Languages size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx('rounded-full px-2 py-0.5 text-[11px]', englishTypeColorMap[e.type] || englishTypeColorMap['其他'])}>{e.type}</span>
                        <span className="text-[11px] text-slate-400">{fmtMinutes(e.durationMinutes)} · {e.date}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{e.content}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => openEdit(e)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-brand-600" aria-label="编辑">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => onDelete(e)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="删除">
                        <Trash2 size={15} />
                      </button>
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
        title={editing ? '编辑英语学习' : '新增英语学习'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? '保存修改' : '保存学习'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">学习类型</label>
              <select className="input-base" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">时长（分钟）</label>
              <input type="number" min="0" className="input-base" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label-base">学习内容</label>
            <textarea className="input-base min-h-[80px] resize-none" autoFocus value={form.content} placeholder="例如：背诵考研核心词汇 List 12（30词）" onChange={(e) => setForm({ ...form, content: e.target.value })} />
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
      <Icon size={16} className="mx-auto text-orange-500" />
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  )
}
