import { useState } from 'react'
import { useStore } from './store/StoreContext'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { AuthModal } from './components/AuthModal'
import { ProfileModal } from './components/ProfileModal'
import { Home } from './pages/Home'
import { TodayPlan } from './pages/TodayPlan'
import { Courses } from './pages/Courses'
import { Reading } from './pages/Reading'
import { English } from './pages/English'
import { Sports } from './pages/Sports'
import { Growth } from './pages/Growth'

const PAGES = {
  home: Home,
  plan: TodayPlan,
  courses: Courses,
  reading: Reading,
  english: English,
  sports: Sports,
  growth: Growth,
}

export default function App() {
  const { activePage } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const Page = PAGES[activePage] || Home

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1200px] animate-fade-in">
            <Page />
          </div>
        </main>
      </div>

      {/* Auth: login / register modal */}
      <AuthModal />

      {/* Profile: edit profile modal (post-login) */}
      <ProfileModal mode="manage" />
    </div>
  )
}
