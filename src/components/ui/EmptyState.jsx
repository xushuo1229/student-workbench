import { clsx } from '../../lib/clsx'

export function EmptyState({ icon: Icon, title, description, action, accent = 'brand' }) {
  const accentMap = {
    brand: 'bg-brand-100 text-brand-500',
    blue: 'bg-blue-100 text-blue-500',
    orange: 'bg-orange-100 text-orange-500',
    green: 'bg-emerald-100 text-emerald-500',
    pink: 'bg-pink-100 text-pink-500',
    slate: 'bg-slate-100 text-slate-400',
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 px-6 py-12 text-center">
      <div className={clsx('mb-4 flex h-16 w-16 items-center justify-center rounded-3xl', accentMap[accent])}>
        {Icon ? <Icon size={28} strokeWidth={1.8} /> : <span className="text-2xl">🌱</span>}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
