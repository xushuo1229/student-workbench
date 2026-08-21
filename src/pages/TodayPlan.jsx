import { useState, useMemo } from 'react'
import {
  ListTodo,
  Plus,
  Pencil,
  Trash2,
  Check,
  Circle,
  Clock,
  Target,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card } from '../components/ui/Card'
import { Modal, Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { todayStr, fmtMinutes, categoryColorMap, clsx } from '../lib/format'

const CATEGORIES = ['学习', '阅读', '英语', '运动', '生活', '其他']

export function TodayPlan() {
  const { data, addPlan, updatePlan, deletePlan, togglePlan } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [todayOnly, setTodayOnly] = useState(true)
  const [form, setForm] = useState({ title: '', category: '学习', estimatedMinutes: 30, date: todayStr() })

  const today = todayStr()
  const list = useMemo(() => {
    const arr = todayOnly ? data.plans.filter((p) => p.date === today) : [...data.plans]
    return arr.sort((a, b) => Number(b.completed) - Number(a.completed) || (a.date < b.date ? 1 : -1))
  }, [data.plans, todayOnly, today])

  const total = list.length
  const done = list.filter((p) => p.completed).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const focus = list.reduce((s, p) => s + (p.completed ? p.estimatedMinutes || 0 : 0), 0)
  const focusAll = list.reduce((s, p) => s + (p.estimatedMinutes || 0), 0)

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', category: '学习', estimatedMinutes: 30, date: todayStr() })
    setOpen(true)
  }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ title: p.title, category: p.category, estimatedMinutes: p.estimatedMinutes, date: p.date })
    setOpen(true)
  }
  const save = () => {
    if (!form.title.trim()) return
    const payload = { ...form, estimatedMinutes: Number(form.estimatedMinutes) || 0 }
    if (editing) updatePlan(editing.id, payload)
    else addPlan(payload)
    setOpen(false)
  }
  const onDelete = (p) => {
    if (window.confirm(`确定删除计划「${p.title}」吗？`)) deletePlan(p.id)
  }

  return (
    <div className="space-y-5">
      {/* Stats + actions */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-1 flex-wrap gap-3">
          <StatCard icon={ListTodo} label="计划总数" value={total} accent="brand" />
          <StatCard icon={Check} label="已完成" value={done} accent="green" />
          <StatCard icon={Target} label="完成度" value={`${pct}%`} accent="orange" />
          <StatCard icon={Clock} label="预计专注" value={fmtMinutes(focusAll)} accent="blue" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={clsx(
              'rounded-2xl px-3 py-2 text-sm font-medium transition',
              todayOnly ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {todayOnly ? '仅看今天' : '显示全部'}
          </button>
          <Button onClick={openAdd}>
            <Plus size={16} /> 新增计划
          </Button>
        </div>
      </div>

      <Card>
        <div className="px-5 py-4">
          {list.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title={todayOnly ? '今天还没有计划' : '还没有计划'}
              description="点击右上角「新增计划」，把今天想做的事记下来吧"
              accent="brand"
              action={<Button onClick={openAdd}><Plus size={16} /> 新增计划</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((p) => (
                <li key={p.id} className="group flex items-center gap-3 py-3">
                  <button
                    onClick={() => togglePlan(p.id)}
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition',
                      p.completed ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-transparent hover:border-brand-400',
                    )}
                    aria-label={p.completed ? '取消完成' : '标记完成'}
                  >
                    <Check size={15} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={clsx('truncate text-sm font-medium', p.completed ? 'text-slate-400 line-through' : 'text-slate-700')}>
                      {p.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className={clsx('rounded-full px-2 py-0.5', categoryColorMap[p.category] || categoryColorMap['其他'])}>{p.category}</span>
                      <span>· {p.estimatedMinutes} 分钟</span>
                      <span>· {p.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => openEdit(p)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" aria-label="编辑">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(p)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label="删除">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {total > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>本次已专注 {fmtMinutes(focus)}</span>
              <span>{pct}% 完成</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-blue-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? '编辑计划' : '新增计划'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save}>{editing ? '保存修改' : '添加'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">计划内容</label>
            <input
              className="input-base"
              value={form.title}
              autoFocus
              placeholder="例如：完成高等数学第3章习题"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">分类</label>
              <select className="input-base" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">预计专注（分钟）</label>
              <input
                type="number"
                min="0"
                className="input-base"
                value={form.estimatedMinutes}
                onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
              />
            </div>
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

function StatCard({ icon: Icon, label, value, accent }) {
  const map = {
    brand: 'bg-brand-100 text-brand-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
    blue: 'bg-blue-100 text-blue-600',
  }
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/85 px-4 py-3 shadow-card">
      <div className={clsx('flex h-10 w-10 items-center justify-center rounded-2xl', map[accent])}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-lg font-bold leading-none text-slate-800">{value}</p>
        <p className="text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  )
}
