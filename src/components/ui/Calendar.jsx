import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from '../../lib/clsx'
import { todayStr } from '../../lib/format'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

export function Calendar({ activityMap = {} }) {
  const today = todayStr()
  const [view, setView] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const firstDay = new Date(view.y, view.m, 1)
  // JS getDay: 0=Sun..6=Sat. Convert so Monday=0
  const lead = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const shift = (delta) => {
    let m = view.m + delta
    let y = view.y
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setView({ y, m })
  }

  const monthLabel = `${view.y} 年 ${view.m + 1} 月`

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => shift(1)} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK.map((w) => (
          <div key={w} className="py-1 text-[11px] font-medium text-slate-400">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const dateStr = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const isToday = dateStr === today
          const has = activityMap[dateStr]
          return (
            <div
              key={dateStr}
              className={clsx(
                'relative flex h-9 items-center justify-center rounded-xl text-[13px] transition',
                isToday ? 'bg-brand-500 font-semibold text-white shadow-sm shadow-brand-300' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {d}
              {has && !isToday && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-400" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
