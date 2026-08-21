import { useStore } from '../store/StoreContext'
import { Card, CardHeader } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Calendar as CalendarView } from '../components/ui/Calendar'
import { ProgressRing } from '../components/ui/ProgressRing'
import { Button } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { BookStack, SunMascot, PlantPot } from '../components/decor/Cute'
import { todayStr, fmtMinutes, categoryColorMap, buildActivityMap } from '../lib/format'
import { clsx } from '../lib/clsx'
import {
  ListTodo,
  GraduationCap,
  BookOpen,
  Languages,
  Dumbbell,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Flame,
  User as UserIcon,
} from 'lucide-react'

const hour = new Date().getHours()
const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

export function Home() {
  const { data, setActivePage, pushToast, openProfile } = useStore()
  const today = todayStr()

  const todaysPlans = data.plans.filter((p) => p.date === today)
  const donePlans = todaysPlans.filter((p) => p.completed).length
  const planPct = todaysPlans.length ? Math.round((donePlans / todaysPlans.length) * 100) : 0
  const focusMins = todaysPlans.reduce((s, p) => s + (p.estimatedMinutes || 0), 0)

  const avgCourse = data.courses.length
    ? Math.round(data.courses.reduce((s, c) => s + (c.progress || 0), 0) / data.courses.length)
    : 0

  const totalBooks = data.readings.length
  const totalPages = data.readings.reduce((s, r) => s + (r.pages || 0), 0)
  const totalReadMins = data.readings.reduce((s, r) => s + (r.durationMinutes || 0), 0)

  const totalEnglishMins = data.english.reduce((s, e) => s + (e.durationMinutes || 0), 0)
  const totalSportMins = data.sports.reduce((s, sp) => s + (sp.durationMinutes || 0), 0)
  const totalCalories = data.sports.reduce((s, sp) => s + (sp.calories || 0), 0)

  const activityMap = buildActivityMap(data)

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-blue-400 px-5 py-6 text-white shadow-soft sm:rounded-4xl sm:p-7">
        <div className="absolute -right-6 -top-10 opacity-30">
          <SunMascot className="h-36 w-36 sm:h-44 sm:w-44" />
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm font-medium text-white/80">{greeting}，{data.user?.name || '同学'} 👋</p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">今天也要元气满满地成长呀</h2>
          <p className="mt-2 text-sm text-white/85">{data.user?.motto || '每天进步一点点'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="soft" onClick={() => setActivePage('plan')}>
              查看今日计划 <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25"
              onClick={() => pushToast('加油，你可以的！')}
            >
              <Flame size={16} /> 开始专注
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-16 hidden lg:block lg:right-24">
          <BookStack className="h-40 w-52" />
        </div>
      </div>

      {/* Today plan + Calendar */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader
            icon={ListTodo}
            title="今日计划"
            subtitle={`${donePlans}/${todaysPlans.length} 已完成 · 预计专注 ${fmtMinutes(focusMins)}`}
            accent="brand"
            action={
              <Button size="sm" variant="soft" onClick={() => setActivePage('plan')}>
                去管理 <ChevronRight size={14} />
              </Button>
            }
          />
          <div className="px-4 py-4 sm:px-5">
            {todaysPlans.length === 0 ? (
              <EmptyState icon={ListTodo} title="今天还没有计划" description="去「今日计划」添加你的第一个小目标吧" accent="brand" />
            ) : (
              <div className="space-y-2">
                {todaysPlans.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-50/70 px-3 py-2.5">
                    <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', p.completed ? 'bg-brand-400' : 'bg-slate-300')} />
                    <span className={clsx('flex-1 truncate text-sm', p.completed ? 'text-slate-400 line-through' : 'text-slate-700')}>
                      {p.title}
                    </span>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px]', categoryColorMap[p.category] || categoryColorMap['其他'])}>
                      {p.category}
                    </span>
                  </div>
                ))}
                <div className="pt-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${planPct}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader icon={CalendarDays} title="日历" subtitle="有记录的日子会亮起小点" accent="blue" />
          <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <CalendarView activityMap={activityMap} />
          </div>
        </Card>
      </div>

      {/* Courses + Reading + English + Profile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        <Card hover onClick={() => setActivePage('courses')}>
          <CardHeader icon={GraduationCap} title="课程进度" accent="purple" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            {data.courses.length === 0 ? (
              <EmptyState icon={GraduationCap} title="还没有课程" accent="purple" />
            ) : (
              <div className="flex items-center gap-3 sm:gap-4">
                <ProgressRing value={avgCourse} size={64} color="#8b5cf6" />
                <div className="space-y-1.5 min-w-0 flex-1">
                  {data.courses.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      <span className="w-20 truncate text-slate-600 sm:w-24">{c.name}</span>
                      <span className="text-slate-400">{c.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card hover onClick={() => setActivePage('reading')}>
          <CardHeader icon={BookOpen} title="每日阅读" accent="blue" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-end gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-800 sm:text-3xl">{totalBooks}</p>
                <p className="text-xs text-slate-400">本已读</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-semibold text-slate-700">{totalPages} 页</p>
                <p className="text-xs text-slate-400">累计 · {fmtMinutes(totalReadMins)}</p>
              </div>
            </div>
            {data.readings[0] && (
              <p className="mt-3 truncate rounded-2xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
                最近：《{data.readings[0].book}》
              </p>
            )}
          </div>
        </Card>

        <Card hover onClick={() => setActivePage('english')}>
          <CardHeader icon={Languages} title="英语学习" accent="orange" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-end gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-800 sm:text-3xl">{data.english.length}</p>
                <p className="text-xs text-slate-400">次学习</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-semibold text-slate-700">{fmtMinutes(totalEnglishMins)}</p>
                <p className="text-xs text-slate-400">累计投入</p>
              </div>
            </div>
          </div>
        </Card>

        <Card hover onClick={openProfile}>
          <CardHeader icon={UserIcon} title="我的资料" accent="brand" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar value={data.user.avatar} size={48} className="shadow-glass sm:!h-14 sm:!w-14" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800 sm:text-base">{data.user.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {[data.user.grade, data.user.major, data.user.school].filter(Boolean).join(' · ') || '点击完善资料'}
                </p>
              </div>
            </div>
            {data.user.motto && (
              <p className="mt-3 truncate rounded-2xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
                "{data.user.motto}"
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Sports + Growth */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <Card hover className="lg:col-span-6" onClick={() => setActivePage('sports')}>
          <CardHeader icon={Dumbbell} title="每日运动" accent="green" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="flex items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5">
            <PlantPot className="h-16 w-16 sm:h-20 sm:w-20" />
            <div className="grid flex-1 grid-cols-3 gap-2 text-center sm:gap-3">
              <div>
                <p className="text-lg font-bold text-slate-800 sm:text-xl">{data.sports.length}</p>
                <p className="text-[11px] text-slate-400">次运动</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800 sm:text-xl">{fmtMinutes(totalSportMins)}</p>
                <p className="text-[11px] text-slate-400">时长</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800 sm:text-xl">{totalCalories}</p>
                <p className="text-[11px] text-slate-400">千卡</p>
              </div>
            </div>
          </div>
        </Card>

        <Card hover className="lg:col-span-6" onClick={() => setActivePage('growth')}>
          <CardHeader icon={TrendingUp} title="成长数据" subtitle="根据真实记录自动汇总" accent="pink" action={<ChevronRight size={16} className="text-slate-300" />} />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="专注时长" value={fmtMinutes(focusMins)} />
              <Stat label="计划完成率" value={`${planPct}%`} />
              <Stat label="累计阅读" value={`${totalPages}页`} />
            </div>
            <Button size="sm" variant="soft" className="mt-4 w-full sm:w-auto" onClick={() => setActivePage('growth')}>
              查看完整成长报告 <ChevronRight size={14} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50/70 px-2 py-2.5 text-center sm:px-3 sm:py-3">
      <p className="text-base font-bold text-slate-800 sm:text-lg">{value}</p>
      <p className="text-[10px] text-slate-400 sm:text-[11px]">{label}</p>
    </div>
  )
}
