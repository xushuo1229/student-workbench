import { Search, Bell, Menu } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { NAV_ITEMS } from './Sidebar'

export function Topbar({ onToggleSidebar }) {
  const { activePage, data, openProfile } = useStore()
  const current = NAV_ITEMS.find((n) => n.key === activePage)
  const title = current ? current.label : '首页'
  const sub = [data.user?.grade, data.user?.major].filter(Boolean).join(' · ') || '自律达人'

  return (
    <header className="z-10 flex items-center gap-3 border-b border-white/60 bg-white/60 px-4 py-3 backdrop-blur-xl sm:gap-4 sm:px-6 lg:px-8">
      {/* Hamburger - mobile only */}
      <button
        onClick={onToggleSidebar}
        className="flex shrink-0 items-center justify-center rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        aria-label="打开菜单"
      >
        <Menu size={22} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-slate-800 sm:text-lg">{title}</h1>
        <p className="hidden text-xs text-slate-400 xs:block">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Search - hidden on small screens */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索计划、课程、书籍…"
            className="w-48 rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-600 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 lg:w-64"
          />
        </div>

        {/* Notification bell */}
        <button className="relative shrink-0 rounded-2xl bg-white/80 p-2 text-slate-500 transition hover:bg-slate-100" aria-label="通知">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* Avatar / profile trigger */}
        <button
          onClick={openProfile}
          className="flex items-center gap-2 rounded-2xl bg-white/80 py-1.5 pl-1.5 pr-2.5 transition hover:bg-slate-100 sm:pr-3"
          aria-label="查看个人资料"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-base">
            {data.user?.avatar || '🙂'}
          </div>
          {/* Name text hidden on very small screens */}
          <div className="hidden leading-tight text-left xs:block">
            <p className="text-xs font-semibold text-slate-700">{data.user?.name || '同学'}</p>
            <p className="text-[10px] text-slate-400 line-clamp-1 max-w-[100px]">{sub}</p>
          </div>
        </button>
      </div>
    </header>
  )
}
