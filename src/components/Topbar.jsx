import { Search, Bell, Settings } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { NAV_ITEMS } from './Sidebar'

export function Topbar() {
  const { activePage, data, openProfile } = useStore()
  const current = NAV_ITEMS.find((n) => n.key === activePage)
  const title = current ? current.label : '首页'
  const sub = [data.user?.grade, data.user?.major].filter(Boolean).join(' · ') || '自律达人'

  return (
    <header className="z-10 flex items-center gap-4 border-b border-white/60 bg-white/60 px-8 py-4 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索计划、课程、书籍…"
            className="w-64 rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-600 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <button className="relative rounded-2xl bg-white/80 p-2.5 text-slate-500 transition hover:bg-slate-100" aria-label="通知">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        <button
          onClick={openProfile}
          className="flex items-center gap-2 rounded-2xl bg-white/80 py-1.5 pl-1.5 pr-3 transition hover:bg-slate-100"
          aria-label="查看个人资料"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-base">
            {data.user?.avatar || '🙂'}
          </div>
          <div className="leading-tight text-left">
            <p className="text-xs font-semibold text-slate-700">{data.user?.name || '同学'}</p>
            <p className="text-[10px] text-slate-400">{sub}</p>
          </div>
        </button>
      </div>
    </header>
  )
}
