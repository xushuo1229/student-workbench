import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'

const STORAGE_KEY = 'student-workbench-v1'
const ACCOUNTS_KEY = 'student-workbench-accounts'
const StoreContext = createContext(null)

/* ---- Account storage (separate from app data) ---- */
function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return {}
}

function saveAccounts(accounts) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)) } catch (e) { /* ignore */ }
}

/* Hash password using SHA-256 (same as AuthModal) */
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '_swb_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ---- App data loader ---- */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch (e) {
    /* ignore corrupt storage */
  }
  return initialData
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(loadData)
  const [activePage, setActivePage] = useState('home')
  const [toasts, setToasts] = useState([])
  const [profileOpen, setProfileOpen] = useState(false)

  // Persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      /* storage may be full / disabled */
    }
  }, [data])

  const pushToast = useCallback((message, type = 'success') => {
    const id = uid()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 2400)
  }, [])

  /* ---------------- Plans ---------------- */
  const addPlan = useCallback((plan) => {
    setData((d) => ({ ...d, plans: [{ id: uid(), completed: false, date: plan.date, ...plan }, ...d.plans] }))
    pushToast('已添加计划')
  }, [pushToast])

  const updatePlan = useCallback((id, patch) => {
    setData((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }, [])

  const deletePlan = useCallback((id) => {
    setData((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }))
    pushToast('已删除计划')
  }, [pushToast])

  const togglePlan = useCallback((id) => {
    setData((d) => ({
      ...d,
      plans: d.plans.map((p) => (p.id === id ? { ...p, completed: !p.completed } : p)),
    }))
  }, [])

  /* ---------------- Courses ---------------- */
  const addCourse = useCallback((course) => {
    setData((d) => ({ ...d, courses: [{ id: uid(), progress: 0, notes: [], color: 'purple', ...course }, ...d.courses] }))
    pushToast('已添加课程')
  }, [pushToast])

  const updateCourse = useCallback((id, patch) => {
    setData((d) => ({ ...d, courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  }, [])

  const deleteCourse = useCallback((id) => {
    setData((d) => ({ ...d, courses: d.courses.filter((c) => c.id !== id) }))
    pushToast('已删除课程')
  }, [pushToast])

  const addNote = useCallback((courseId, content) => {
    setData((d) => ({
      ...d,
      courses: d.courses.map((c) =>
        c.id === courseId ? { ...c, notes: [{ id: uid(), content, createdAt: new Date().toISOString().slice(0, 10) }, ...c.notes] } : c,
      ),
    }))
    pushToast('已添加笔记')
  }, [pushToast])

  const deleteNote = useCallback((courseId, noteId) => {
    setData((d) => ({
      ...d,
      courses: d.courses.map((c) =>
        c.id === courseId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c,
      ),
    }))
  }, [])

  /* ---------------- Readings ---------------- */
  const addReading = useCallback((reading) => {
    setData((d) => ({ ...d, readings: [{ id: uid(), date: reading.date, ...reading }, ...d.readings] }))
    pushToast('已记录阅读')
  }, [pushToast])

  const updateReading = useCallback((id, patch) => {
    setData((d) => ({ ...d, readings: d.readings.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }, [])

  const deleteReading = useCallback((id) => {
    setData((d) => ({ ...d, readings: d.readings.filter((r) => r.id !== id) }))
    pushToast('已删除阅读记录')
  }, [pushToast])

  /* ---------------- English ---------------- */
  const addEnglish = useCallback((item) => {
    setData((d) => ({ ...d, english: [{ id: uid(), date: item.date, ...item }, ...d.english] }))
    pushToast('已保存英语学习')
  }, [pushToast])

  const updateEnglish = useCallback((id, patch) => {
    setData((d) => ({ ...d, english: d.english.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  }, [])

  const deleteEnglish = useCallback((id) => {
    setData((d) => ({ ...d, english: d.english.filter((e) => e.id !== id) }))
    pushToast('已删除英语学习')
  }, [pushToast])

  /* ---------------- Sports ---------------- */
  const addSport = useCallback((sport) => {
    setData((d) => ({ ...d, sports: [{ id: uid(), date: sport.date, ...sport }, ...d.sports] }))
    pushToast('已记录运动')
  }, [pushToast])

  const updateSport = useCallback((id, patch) => {
    setData((d) => ({ ...d, sports: d.sports.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }, [])

  const deleteSport = useCallback((id) => {
    setData((d) => ({ ...d, sports: d.sports.filter((s) => s.id !== id) }))
    pushToast('已删除运动记录')
  }, [pushToast])

  /* ---------------- Weekly Plan ---------------- */
  const addWeekly = useCallback((item) => {
    setData((d) => ({ ...d, weeklyPlan: [{ id: uid(), completed: false, ...item }, ...d.weeklyPlan] }))
    pushToast('已添加周计划')
  }, [pushToast])

  const updateWeekly = useCallback((id, patch) => {
    setData((d) => ({ ...d, weeklyPlan: d.weeklyPlan.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
  }, [])

  const deleteWeekly = useCallback((id) => {
    setData((d) => ({ ...d, weeklyPlan: d.weeklyPlan.filter((w) => w.id !== id) }))
    pushToast('已删除周计划')
  }, [pushToast])

  const toggleWeekly = useCallback((id) => {
    setData((d) => ({
      ...d,
      weeklyPlan: d.weeklyPlan.map((w) => (w.id === id ? { ...w, completed: !w.completed } : w)),
    }))
  }, [])

  const resetAll = useCallback(() => {
    setData(initialData)
    pushToast('已恢复示例数据')
  }, [pushToast])

  /* ---------------- Auth: Register (username + password) ---------------- */
  const registerUser = useCallback(async (username, password, profile) => {
    const accounts = loadAccounts()
    if (accounts[username]) return false // username taken

    const hashedPassword = await hashPassword(password)
    accounts[username] = {
      passwordHash: hashedPassword,
      profile: {
        name: profile.name || username,
        avatar: profile.avatar || '🍊',
        grade: profile.grade || '',
        major: profile.major || '',
        school: profile.school || '',
        motto: profile.motto || '',
      },
      createdAt: new Date().toISOString(),
    }
    saveAccounts(accounts)

    // Auto-login after registration
    setData((d) => ({
      ...d,
      isLoggedIn: true,
      currentUser: username,
      user: { ...accounts[username].profile },
    }))
    return true
  }, [])

  /* ---------------- Auth: Login (username + password) ---------------- */
  const loginUserWithPassword = useCallback(async (username, password) => {
    const accounts = loadAccounts()
    const account = accounts[username]
    if (!account) return false

    const hashedInput = await hashPassword(password)
    if (hashedInput !== account.passwordHash) return false

    // Login success — load this user's profile into app state
    setData((d) => ({
      ...d,
      isLoggedIn: true,
      currentUser: username,
      user: { ...account.profile },
    }))
    return true
  }, [])

  /* ---------------- User Profile (post-login editing) ---------------- */
  const loginUser = useCallback((profile) => {
    // Legacy: direct profile set (used by old login flow, kept for compat)
    setData((d) => ({ ...d, isLoggedIn: true, user: { ...d.user, ...profile } }))
    pushToast('欢迎回来，开始今日成长 🎉')
  }, [pushToast])

  const updateUser = useCallback((patch) => {
    setData((d) => {
      const newUser = { ...d.user, ...patch }
      // Also sync back to account storage if logged in via username
      if (d.currentUser) {
        const accounts = loadAccounts()
        if (accounts[d.currentUser]) {
          accounts[d.currentUser].profile = newUser
          saveAccounts(accounts)
        }
      }
      return { ...d, user: newUser }
    })
    pushToast('资料已更新')
  }, [pushToast])

  const logoutUser = useCallback(() => {
    setData((d) => ({ ...d, isLoggedIn: false, currentUser: '' }))
    setProfileOpen(false)
    pushToast('已退出登录')
  }, [pushToast])

  const openProfile = useCallback(() => setProfileOpen(true), [])
  const closeProfile = useCallback(() => setProfileOpen(false), [])

  const value = {
    data,
    activePage,
    setActivePage,
    toasts,
    pushToast,
    // user / auth
    profileOpen,
    openProfile,
    closeProfile,
    registerUser,
    loginUserWithPassword,
    loginUser,
    updateUser,
    logoutUser,
    // plans
    addPlan, updatePlan, deletePlan, togglePlan,
    // courses
    addCourse, updateCourse, deleteCourse, addNote, deleteNote,
    // readings
    addReading, updateReading, deleteReading,
    // english
    addEnglish, updateEnglish, deleteEnglish,
    // sports
    addSport, updateSport, deleteSport,
    // weekly
    addWeekly, updateWeekly, deleteWeekly, toggleWeekly,
    resetAll,
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-soft animate-pop-in ${
                t.type === 'success' ? 'bg-brand-500' : t.type === 'error' ? 'bg-rose-500' : 'bg-slate-700'
              }`}
            >
              <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}</span>
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
