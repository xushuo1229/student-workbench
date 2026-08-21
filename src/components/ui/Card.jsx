import { clsx } from '../../lib/clsx'

export function Card({ className, children, onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-3xl border border-white/70 bg-white/85 shadow-card backdrop-blur-sm',
        hover && 'transition hover:-translate-y-0.5 hover:shadow-soft cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ icon: Icon, title, subtitle, accent = 'brand', action }) {
  const accentMap = {
    brand: 'bg-brand-100 text-brand-600',
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-emerald-100 text-emerald-600',
    pink: 'bg-pink-100 text-pink-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={clsx('flex h-10 w-10 items-center justify-center rounded-2xl', accentMap[accent])}>
            <Icon size={20} strokeWidth={2.2} />
          </div>
        )}
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
