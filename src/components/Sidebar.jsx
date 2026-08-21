import {
  LayoutDashboard,
  ListTodo,
  GraduationCap,
  BookOpen,
  Languages,
  Dumbbell,
  BarChart3,
  Sparkles,
  Settings,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { clsx } from '../lib/clsx'
import { BookStack } from './decor/Cute'

export const NAV_ITEMS = [
  { key: 'home', label: '首页', icon: LayoutDashboard },
  { key: 'plan', label: '今日计划', icon: ListTodo },
  { key: 'courses', label: '课程学习', icon: GraduationCap },
  { key: 'reading', label: '每日阅读', icon: BookOpen },
  { key: 'english', label: '英语学习', icon: Languages },
  { key: 'sports', label: '每日运动', icon: Dumbbell },
  { key: 'growth', label: '成长数据', icon: BarChart3 },
]

export function Sidebar({ open, onClose }) {
  const { activePage, setActivePage, openSettings } = useStore()

  function handleNav(key) {
    setActivePage(key)
    // auto-close drawer on mobile after navigation
    if (onClose) onClose()
  }

  return (
    <>
      {/* Backdrop - mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'z-40 flex h-full w-64 shrink-0 flex-col gap-2 border-r border-white/60 bg-white/70 px-4 py-5 backdrop-blur-xl',
          // Desktop: always visible
          'lg:relative lg:block',
          // Mobile: fixed drawer that slides in/out
          'fixed inset-y-0 left-0 transform transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 shadow-sm">
              <BookStack className="h-10 w-10" />
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight text-slate-800">自律工作台</p>
              <p className="text-[11px] text-slate-400">Student Self-Discipline</p>
            </div>
          </div>
          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
              aria-label="关闭菜单"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activePage === item.key
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-brand-100 text-brand-700 shadow-sm shadow-brand-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-brand-500" />
                )}
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Settings button */}
        <button
          onClick={openSettings}
          className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Settings size={19} strokeWidth={2} />
          设置
        </button>

        {/* Soft promo card */}
        <div className="mt-2 rounded-3xl bg-gradient-to-br from-brand-100 to-blue-100 p-4">
          <div className="flex items-center gap-2 text-brand-700">
            <Sparkles size={16} />
            <span className="text-xs font-semibold">每日小目标</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            打开工作台，先完成一件最重要的事，今天就赢了一半。
          </p>
        </div>
      </aside>
    </>
  )
}
