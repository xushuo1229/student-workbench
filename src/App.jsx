import { useStore } from './store/StoreContext'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
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
  const Page = PAGES[activePage] || Home

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-[1200px] animate-fade-in">
            <Page />
          </div>
        </main>
      </div>

      {/* 个性化登录 + 个人资料 */}
      <ProfileModal mode="login" />
      <ProfileModal mode="manage" />
    </div>
  )
}
