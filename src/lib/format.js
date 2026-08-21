export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const todayStr = () => {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const weekdayName = (i) =>
  ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i] // 0=Mon .. 6=Sun

export const fmtTime = (s) => {
  const sec = Math.max(0, Math.floor(s))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`
}

export const fmtMinutes = (mins) => {
  const m = Math.max(0, Math.round(mins || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`
}

// Maps a "soft" color key to literal Tailwind classes (so Tailwind can detect them)
export const courseColorMap = {
  purple: { chip: 'bg-brand-100 text-brand-700', bar: 'bg-brand-400', dot: 'bg-brand-400', soft: 'bg-brand-50' },
  blue: { chip: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400', dot: 'bg-blue-400', soft: 'bg-blue-50' },
  orange: { chip: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', dot: 'bg-orange-400', soft: 'bg-orange-50' },
  green: { chip: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400', dot: 'bg-emerald-400', soft: 'bg-emerald-50' },
  pink: { chip: 'bg-pink-100 text-pink-700', bar: 'bg-pink-400', dot: 'bg-pink-400', soft: 'bg-pink-50' },
}

export const categoryColorMap = {
  学习: 'bg-brand-100 text-brand-700',
  阅读: 'bg-blue-100 text-blue-700',
  英语: 'bg-orange-100 text-orange-700',
  运动: 'bg-emerald-100 text-emerald-700',
  生活: 'bg-pink-100 text-pink-700',
  其他: 'bg-slate-100 text-slate-600',
}

export const englishTypeColorMap = {
  单词: 'bg-orange-100 text-orange-700',
  听力: 'bg-blue-100 text-blue-700',
  阅读: 'bg-brand-100 text-brand-700',
  口语: 'bg-emerald-100 text-emerald-700',
  写作: 'bg-pink-100 text-pink-700',
  其他: 'bg-slate-100 text-slate-600',
}

// Build a map of date -> activity count from all records
export { clsx } from './clsx'

export const buildActivityMap = (data) => {
  const map = {}
  const bump = (date) => {
    if (!date) return
    map[date] = (map[date] || 0) + 1
  }
  ;(data.plans || []).forEach((p) => bump(p.date))
  ;(data.readings || []).forEach((r) => bump(r.date))
  ;(data.english || []).forEach((e) => bump(e.date))
  ;(data.sports || []).forEach((s) => bump(s.date))
  return map
}
