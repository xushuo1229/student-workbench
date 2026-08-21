import { useMemo, useState } from 'react'
import { Search, Bell, Menu, Settings, ChevronRight } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { NAV_ITEMS } from './Sidebar'
import { Avatar } from './ui/Avatar'

export function Topbar({ onToggleSidebar }) {
  const { activePage, data, openProfile, openSettings, setActivePage } = useStore()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const current = NAV_ITEMS.find((n) => n.key === activePage)
  const title = current ? current.label : '首页'
  const sub = [data.user?.grade, data.user?.major].filter(Boolean).join(' · ') || '自律达人'

  /* 全站搜索：计划 / 课程 / 阅读 / 英语 / 运动 */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const hit = (item) => {
      const title = item?.title || item?.name || item?.book || item?.content || item?.project || ''
      return title.toLowerCase().includes(q)
    }
    const groups = []
    const planHits = data.plans.filter(hit)
    if (planHits.length) groups.push({ key: 'plan', label: '今日计划', items: planHits.slice(0, 3) })
    const courseHits = data.courses.filter(hit)
    if (courseHits.length) groups.push({ key: 'courses', label: '课程学习', items: courseHits.slice(0, 3) })
    const readHits = data.readings.filter(hit)
    if (readHits.length) groups.push({ key: 'reading', label: '每日阅读', items: readHits.slice(0, 3) })
    const engHits = data.english.filter(hit)
    if (engHits.length) groups.push({ key: 'english', label: '英语学习', items: engHits.slice(0, 3) })
    const sportHits = data.sports.filter(hit)
    if (sportHits.length) groups.push({ key: 'sports', label: '每日运动', items: sportHits.slice(0, 3) })
    return groups
  }, [query, data])

  const itemTitle = (x) => x?.title || x?.name || x?.book || x?.content || x?.project || ''
  const goto = (key) => {
    setActivePage(key)
    setQuery('')
    setFocused(false)
  }

  return (
    <header className="z-10 flex items-center gap-3 border-b border-white/40 bg-white/40 px-4 py-3 backdrop-blur-2xl sm:gap-4 sm:px-6 lg:px-8">
      {/* Hamburger - mobile only */}
      <button
        onClick={onToggleSidebar}
        className="flex shrink-0 items-center justify-center rounded-xl p-2 text-slate-500 transition hover:bg-white/60 hover:text-slate-700 lg:hidden"
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length) goto(results[0].key)
              if (e.key === 'Escape') setFocused(false)
            }}
            className="w-48 rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-600 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 lg:w-64"
          />

          {/* Search results dropdown */}
          {focused && query.trim() && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white/95 shadow-soft backdrop-blur-md">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">没有找到「{query.trim()}」相关记录</div>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1">
                  {results.map((g) => (
                    <div key={g.key} className="pt-1">
                      <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold text-slate-400">
                        <span className="h-1 w-1 rounded-full bg-brand-400" />
                        {g.label}
                      </div>
                      {g.items.map((item, i) => (
                        <button
                          key={item.id || i}
                          onMouseDown={(e) => { e.preventDefault(); goto(g.key) }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                        >
                          <span className="min-w-0 flex-1 truncate">{itemTitle(item)}</span>
                          <ChevronRight size={13} className="shrink-0 text-slate-300" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notification bell */}
        <button className="relative shrink-0 rounded-2xl bg-white/60 p-2 text-slate-500 transition hover:bg-white/80" aria-label="通知">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* Settings gear */}
        <button
          onClick={openSettings}
          className="shrink-0 rounded-2xl bg-white/60 p-2 text-slate-500 transition hover:bg-white/80"
          aria-label="设置"
        >
          <Settings size={18} />
        </button>

        {/* Avatar / profile trigger */}
        <button
          onClick={openProfile}
          className="flex items-center gap-2 rounded-2xl bg-white/60 py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/80 sm:pr-3"
          aria-label="查看个人资料"
        >
          <Avatar value={data.user?.avatar} size={32} />
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
