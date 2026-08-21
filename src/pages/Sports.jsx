import { useState } from 'react'
import {
  Dumbbell,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Flame,
  CalendarDays,
  Check,
  Circle,
  Footprints,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card, CardHeader } from '../components/ui/Card'
import { Modal, Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Timer } from '../components/ui/Timer'
import { todayStr, fmtMinutes, weekdayName, clsx } from '../lib/format'

const STATES = ['轻松', '一般', '累', '超累']
const stateColor = {
  轻松: 'bg-emerald-100 text-emerald-700',
  一般: 'bg-blue-100 text-blue-700',
  累: 'bg-orange-100 text-orange-700',
  超累: 'bg-rose-100 text-rose-700',
}

export function Sports() {
  const { data, addSport, updateSport, deleteSport, addWeekly, updateWeekly, deleteWeekly, toggleWeekly, pushToast } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ project: '', durationMinutes: 0, calories: 0, state: '轻松', note: '', date: todayStr() })

  const [wOpen, setWOpen] = useState(false)
  const [wForm, setWForm] = useState({ weekday: 0, project: '', targetMinutes: 30, note: '' })

  const totalSessions = data.sports.length
  const totalMins = data.sports.reduce((s, x) => s + (Number(x.durationMinutes) || 0), 0)
  const totalCal = data.sports.reduce((s, x) => s + (Number(x.calories) || 0), 0)
  const weekDone = data.weeklyPlan.filter((w) => w.completed).length

  // Sports CRUD
  const openAdd = (duration = 0) => {
    setEditing(null)
    setForm({ project: '', durationMinutes: duration, calories: 0, state: '轻松', note: '', date: todayStr() })
    setOpen(true)
  }
  const openEdit = (s) => {
    setEditing(s)
    setForm({ project: s.project, durationMinutes: s.durationMinutes, calories: s.calories, state: s.state, note: s.note || '', date: s.date })
    setOpen(true)
  }
  const save = () => {
    if (!form.project.trim()) return
    const payload = {
      project: form.project.trim(),
      durationMinutes: Number(form.durationMinutes) || 0,
      calories: Number(form.calories) || 0,
      state: form.state,
      note: form.note.trim(),
      date: form.date,
    }
    if (editing) updateSport(editing.id, payload)
    else addSport(payload)
    setOpen(false)
  }
  const onDelete = (s) => {
    if (window.confirm(`确定删除「${s.project}」的运动记录吗？`)) deleteSport(s.id)
  }

  // Weekly CRUD
  const openWAdd = (wd = 0) => {
    setWForm({ weekday: wd, project: '', targetMinutes: 30, note: '' })
    setWOpen(true)
  }
  const saveW = () => {
    if (!wForm.project.trim()) return
    addWeekly({ weekday: Number(wForm.weekday), project: wForm.project.trim(), targetMinutes: Number(wForm.targetMinutes) || 0, note: wForm.note.trim() })
    setWOpen(false)
  }
  const onWDelete = (w) => {
    if (window.confirm(`确定删除周计划「${weekdayName(w.weekday)} ${w.project}」吗？`)) deleteWeekly(w.id)
  }

  const onTimerUse = (seconds) => {
    const mins = Math.round(seconds / 60)
    openAdd(mins)
    pushToast(`已填入本次运动时长 ${mins} 分钟`)
  }

  // group weekly by weekday
  const grouped = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({
    wd,
    items: data.weeklyPlan.filter((w) => w.weekday === wd),
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Timer accent="green" onUse={onTimerUse} useLabel="使用本次时长" hint="运动计时" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat icon={Footprints} label="次数" value={totalSessions} />
            <MiniStat icon={Clock} label="时长" value={fmtMinutes(totalMins)} />
            <MiniStat icon={Flame} label="千卡" value={totalCal} />
          </div>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={Dumbbell}
            title="运动记录"
            subtitle="记录每次运动的项目、时长与身体状态"
            accent="green"
            action={<Button size="sm" onClick={() => openAdd()}><Plus size={14} /> 新增运动</Button>}
          />
          <div className="px-5 py-4">
            {data.sports.length === 0 ? (
              <EmptyState icon={Dumbbell} title="还没有运动记录" description="动起来，用计时器记录你的每一次坚持" accent="green" />
            ) : (
              <ul className="space-y-3">
                {data.sports.map((s) => (
                  <li key={s.id} className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:bg-emerald-50/40">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <Dumbbell size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">{s.project}</p>
                        <span className={clsx('rounded-full px-2 py-0.5 text-[11px]', stateColor[s.state] || stateColor['一般'])}>{s.state}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-600">{fmtMinutes(s.durationMinutes)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{s.calories} 千卡</span>
                        <span>{s.date}</span>
                      </div>
                      {s.note && <p className="mt-1.5 text-sm text-slate-600">📝 {s.note}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => openEdit(s)} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:text-brand-600" aria-label="编辑">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => onDelete(s)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="删除">
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

      {/* Weekly plan */}
      <Card>
        <CardHeader
          icon={CalendarDays}
          title="一周运动计划"
          subtitle={`本周已完成 ${weekDone}/${data.weeklyPlan.length} 项`}
          accent="blue"
          action={<Button size="sm" onClick={() => openWAdd(0)}><Plus size={14} /> 新增周计划</Button>}
        />
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {grouped.map(({ wd, items }) => (
              <div key={wd} className="rounded-2xl bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{weekdayName(wd)}</span>
                  <button onClick={() => openWAdd(wd)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-brand-600" aria-label="添加">
                    <Plus size={14} />
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-slate-300">休息日</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((w) => (
                      <li key={w.id} className="group rounded-xl bg-white px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleWeekly(w.id)}
                            className={clsx(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition',
                              w.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent',
                            )}
                            aria-label={w.completed ? '取消完成' : '标记完成'}
                          >
                            <Check size={10} />
                          </button>
                          <span className={clsx('flex-1 truncate text-[11px]', w.completed ? 'text-slate-400 line-through' : 'text-slate-600')}>{w.project}</span>
                          <button onClick={() => onWDelete(w)} className="text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100" aria-label="删除">
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <p className="ml-5 text-[10px] text-slate-400">{w.targetMinutes} 分钟</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Sport modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑运动记录' : '新增运动记录'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? '保存修改' : '保存记录'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">运动项目</label>
            <input className="input-base" autoFocus value={form.project} placeholder="例如：慢跑 / 瑜伽 / 跳绳" onChange={(e) => setForm({ ...form, project: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-base">时长（分钟）</label>
              <input type="number" min="0" className="input-base" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div>
              <label className="label-base">消耗（千卡）</label>
              <input type="number" min="0" className="input-base" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
            </div>
            <div>
              <label className="label-base">身体状态</label>
              <select className="input-base" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-base">备注</label>
            <input className="input-base" value={form.note} placeholder="选填，例如：配速稳定 / 心率偏高" onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div>
            <label className="label-base">日期</label>
            <input type="date" className="input-base" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Weekly modal */}
      <Modal
        open={wOpen}
        onClose={() => setWOpen(false)}
        title="新增周计划"
        footer={
          <>
            <Button variant="ghost" onClick={() => setWOpen(false)}>取消</Button>
            <Button onClick={saveW}>添加</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">星期</label>
            <select className="input-base" value={wForm.weekday} onChange={(e) => setWForm({ ...wForm, weekday: e.target.value })}>
              {[0, 1, 2, 3, 4, 5, 6].map((wd) => <option key={wd} value={wd}>{weekdayName(wd)}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">运动项目</label>
            <input className="input-base" autoFocus value={wForm.project} placeholder="例如：慢跑 / 力量训练" onChange={(e) => setWForm({ ...wForm, project: e.target.value })} />
          </div>
          <div>
            <label className="label-base">目标时长（分钟）</label>
            <input type="number" min="0" className="input-base" value={wForm.targetMinutes} onChange={(e) => setWForm({ ...wForm, targetMinutes: e.target.value })} />
          </div>
          <div>
            <label className="label-base">备注</label>
            <input className="input-base" value={wForm.note} placeholder="选填" onChange={(e) => setWForm({ ...wForm, note: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/85 px-2 py-3 text-center shadow-card">
      <Icon size={16} className="mx-auto text-emerald-500" />
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  )
}
