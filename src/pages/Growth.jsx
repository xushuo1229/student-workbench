import {
  TrendingUp,
  ListTodo,
  GraduationCap,
  BookOpen,
  Languages,
  Dumbbell,
  Flame,
  CalendarCheck,
  RotateCcw,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Card, CardHeader } from '../components/ui/Card'
import { ProgressRing } from '../components/ui/ProgressRing'
import { Button } from '../components/ui/Modal'
import { buildActivityMap, fmtMinutes, courseColorMap, clsx } from '../lib/format'

function dateStr(d) {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function Growth() {
  const { data, resetAll, pushToast } = useStore()
  const activityMap = buildActivityMap(data)

  // Plan completion
  const totalPlans = data.plans.length
  const donePlans = data.plans.filter((p) => p.completed).length
  const planPct = totalPlans ? Math.round((donePlans / totalPlans) * 100) : 0
  const focusPlanned = data.plans.reduce((s, p) => s + (Number(p.estimatedMinutes) || 0), 0)
  const focusDone = data.plans.filter((p) => p.completed).reduce((s, p) => s + (Number(p.estimatedMinutes) || 0), 0)

  // Courses
  const avgCourse = data.courses.length
    ? Math.round(data.courses.reduce((s, c) => s + (Number(c.progress) || 0), 0) / data.courses.length)
    : 0

  // Reading
  const totalBooks = data.readings.length
  const totalPages = data.readings.reduce((s, r) => s + (Number(r.pages) || 0), 0)
  const readMins = data.readings.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0)

  // English
  const engItems = data.english.length
  const engMins = data.english.reduce((s, e) => s + (Number(e.durationMinutes) || 0), 0)

  // Sports
  const sportSessions = data.sports.length
  const sportMins = data.sports.reduce((s, x) => s + (Number(x.durationMinutes) || 0), 0)
  const totalCal = data.sports.reduce((s, x) => s + (Number(x.calories) || 0), 0)

  // Weekly
  const weekTotal = data.weeklyPlan.length
  const weekDone = data.weeklyPlan.filter((w) => w.completed).length
  const weekPct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0

  // 7-day activity
  const days = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = dateStr(d)
    days.push({ ds, label: `${d.getMonth() + 1}/${d.getDate()}`, count: activityMap[ds] || 0 })
  }
  const maxDay = Math.max(1, ...days.map((x) => x.count))

  // Streak (consecutive days with activity up to today)
  let streak = 0
  const cur = new Date()
  // if today has no activity, allow streak to start from yesterday
  while (true) {
    const ds = dateStr(cur)
    if (activityMap[ds]) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else {
      if (streak === 0 && dateStr(cur) === dateStr(today)) {
        // today empty, try yesterday
        cur.setDate(cur.getDate() - 1)
        continue
      }
      break
    }
  }

  const moduleMins = [
    { label: '阅读', mins: readMins, color: 'bg-blue-400' },
    { label: '英语', mins: engMins, color: 'bg-orange-400' },
    { label: '运动', mins: sportMins, color: 'bg-emerald-400' },
  ]
  const maxModule = Math.max(1, ...moduleMins.map((m) => m.mins))

  const stats = [
    { icon: ListTodo, label: '计划完成率', value: `${planPct}%`, accent: 'brand' },
    { icon: CalendarCheck, label: '连续打卡', value: `${streak} 天`, accent: 'green' },
    { icon: BookOpen, label: '累计阅读', value: `${totalPages} 页`, accent: 'blue' },
    { icon: Languages, label: '英语学习', value: `${engItems} 次`, accent: 'orange' },
    { icon: Dumbbell, label: '运动消耗', value: `${totalCal} 千卡`, accent: 'pink' },
    { icon: Flame, label: '周计划完成', value: `${weekPct}%`, accent: 'slate' },
  ]

  return (
    <div className="space-y-5">
      {/* Top summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Overall + 7-day */}
        <Card className="lg:col-span-4">
          <CardHeader icon={TrendingUp} title="总体完成度" subtitle="计划 + 周计划综合" accent="brand" />
          <div className="flex flex-col items-center px-5 py-6">
            <ProgressRing value={Math.round((planPct + weekPct) / 2)} size={128} stroke={12} />
            <div className="mt-4 grid w-full grid-cols-2 gap-3 text-center">
              <Mini label="计划完成" value={`${donePlans}/${totalPlans}`} />
              <Mini label="周计划完成" value={`${weekDone}/${weekTotal}`} />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader icon={CalendarCheck} title="近 7 天活跃度" subtitle="有记录的日子会被点亮" accent="green" />
          <div className="px-5 py-6">
            <div className="flex h-40 items-end justify-between gap-2">
              {days.map((d) => (
                <div key={d.ds} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={clsx('w-full rounded-t-xl transition-all', d.count ? 'bg-gradient-to-t from-brand-400 to-blue-400' : 'bg-slate-100')}
                      style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
                      title={`${d.ds}：${d.count} 条记录`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Module time */}
        <Card className="lg:col-span-6">
          <CardHeader icon={Flame} title="各模块投入时长" subtitle="阅读 / 英语 / 运动（分钟）" accent="orange" />
          <div className="space-y-4 px-5 py-6">
            {moduleMins.map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>{m.label}</span>
                  <span className="font-semibold text-slate-700">{fmtMinutes(m.mins)}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={clsx('h-full rounded-full transition-all', m.color)} style={{ width: `${(m.mins / maxModule) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Course progress */}
        <Card className="lg:col-span-6">
          <CardHeader icon={GraduationCap} title="课程进度分布" subtitle={`平均 ${avgCourse}%`} accent="purple" />
          <div className="space-y-3 px-5 py-6">
            {data.courses.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-300">还没有课程数据</p>
            ) : (
              data.courses.map((c) => {
                const col = courseColorMap[c.color] || courseColorMap.purple
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{c.name}</span>
                      <span className="font-semibold text-slate-700">{c.progress}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={clsx('h-full rounded-full transition-all', col.bar)} style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-dashed border-slate-200 bg-white/50 px-5 py-4">
        <p className="text-xs text-slate-400">所有数据均来自你在各模块的真实记录，新增或删除后会自动重新汇总。</p>
        <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('恢复为初始示例数据？你新增的内容会被覆盖。')) { resetAll(); pushToast('已恢复示例数据') } }}>
          <RotateCcw size={14} /> 恢复示例数据
        </Button>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }) {
  const map = {
    brand: 'bg-brand-100 text-brand-600',
    green: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    pink: 'bg-pink-100 text-pink-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-card">
      <div className={clsx('mb-2 flex h-9 w-9 items-center justify-center rounded-2xl', map[accent])}>
        <Icon size={17} />
      </div>
      <p className="text-lg font-bold leading-none text-slate-800">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50/70 px-2 py-2">
      <p className="text-sm font-bold text-slate-700">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}
