import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'

const ACCOUNTS_KEY = 'student-workbench-accounts'
const SESSION_KEY = 'student-workbench-session'    // {isLoggedIn, currentUser}
const DATA_KEY_PREFIX = 'student-workbench-data-'  // per-user: student-workbench-data-{username}
const SETTINGS_GLOBAL_KEY = 'student-workbench-settings' // global settings (bg, etc)
const EXPORT_VERSION = 1
const StoreContext = createContext(null)

/* ---- Account storage ---- */
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

/* ---- Session (login state only, no user data) ---- */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return { isLoggedIn: false, currentUser: '' }
}

function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch (e) { /* ignore */ }
}

/* ---- Per-user data loader/saver ---- */
function loadUserData(username) {
  const key = DATA_KEY_PREFIX + username
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch (e) { /* ignore */ }
  // Fresh user data from template
  return {
    ...initialData,
    isLoggedIn: true,
    currentUser: username,
  }
}

function saveUserData(username, userData) {
  const key = DATA_KEY_PREFIX + username
  try { localStorage.setItem(key, JSON.stringify(userData)) } catch (e) { /* ignore */ }
}

/* ---- Global settings (shared across users, e.g. background) ---- */
function loadGlobalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_GLOBAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return initialData.settings || {}
}

function saveGlobalSettings(settings) {
  try { localStorage.setItem(SETTINGS_GLOBAL_KEY, JSON.stringify(settings)) } catch (e) { /* ignore */ }
}

/* ---- Password hash ---- */
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '_swb_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ---- Migration: convert old single-data format to per-user ---- */
function migrateOldData() {
  const OLD_KEY = 'student-workbench-v1'
  try {
    const raw = localStorage.getItem(OLD_KEY)
    if (!raw) return false
    const oldData = JSON.parse(raw)
    if (!oldData || !oldData.currentUser) return false

    const username = oldData.currentUser
    // Check if already migrated
    if (localStorage.getItem(DATA_KEY_PREFIX + username)) return false

    // Save old data under the user's key (strip session fields)
    const { isLoggedIn, currentUser, ...userData } = oldData
    saveUserData(username, userData)

    // Save settings globally if present
    if (oldData.settings) {
      saveGlobalSettings(oldData.settings)
    }

    // Remove old key to prevent re-migration
    localStorage.removeItem(OLD_KEY)
    return true
  } catch (e) {
    return false
  }
}

/* ---- Export / Import ---- */
export function exportAllData() {
  const accounts = loadAccounts()
  const usersData = {}
  const globalSettings = loadGlobalSettings()

  // Collect each user's data
  for (const username of Object.keys(accounts)) {
    try {
      const raw = localStorage.getItem(DATA_KEY_PREFIX + username)
      if (raw) usersData[username] = JSON.parse(raw)
    } catch (e) { /* skip corrupt */ }
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    usersData,
    globalSettings,
  }
}

export function importAllData(jsonObj, mode = 'merge') {
  // mode: 'merge' = merge with existing, 'overwrite' = replace everything
  if (!jsonObj || jsonObj.version === undefined) throw new Error('无效的备份文件格式')

  if (mode === 'overwrite') {
    // Clear existing
    const existingAccounts = loadAccounts()
    for (const u of Object.keys(existingAccounts)) {
      localStorage.removeItem(DATA_KEY_PREFIX + u)
    }
  }

  // Import accounts (merge or overwrite)
  const existingAccounts = mode === 'overwrite' ? {} : loadAccounts()
  const mergedAccounts = { ...existingAccounts, ...(jsonObj.accounts || {}) }
  saveAccounts(mergedAccounts)

  // Import per-user data
  for (const [username, userData] of Object.entries(jsonObj.usersData || {})) {
    if (typeof userData === 'object' && userData !== null) {
      saveUserData(username, userData)
    }
  }

  // Import global settings
  if (jsonObj.globalSettings) {
    saveGlobalSettings({ ...loadGlobalSettings(), ...jsonObj.globalSettings })
  }

  return Object.keys(jsonObj.accounts || {}).length
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(() => {
    // Try migration first
    migrateOldData()

    // Load session
    const session = loadSession()
    if (session.isLoggedIn && session.currentUser) {
      // Load this specific user's data
      const userData = loadUserData(session.currentUser)
      return {
        ...userData,
        isLoggedIn: true,
        currentUser: session.currentUser,
        settings: loadGlobalSettings(),
      }
    }
    // Not logged in — show initial data (will be replaced on login)
    return { ...initialData, settings: loadGlobalSettings() }
  })

  const [activePage, setActivePage] = useState('home')
  const [toasts, setToasts] = useState([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Track current user for saving
  const currentUserRef = useRef(data.currentUser)

  // Persist user data on every change (only when logged in)
  useEffect(() => {
    currentUserRef.current = data.currentUser
    // Always persist global settings
    if (data.settings) {
      saveGlobalSettings(data.settings)
    }
    // Persist per-user data only when logged in
    if (data.isLoggedIn && data.currentUser) {
      const { isLoggedIn, currentUser, ...userData } = data
      saveUserData(currentUser, { ...userData, isLoggedIn: true, currentUser })
    }
    // Update session
    saveSession({ isLoggedIn: data.isLoggedIn, currentUser: data.currentUser || '' })
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
    setData({ ...initialData, settings: loadGlobalSettings() })
    pushToast('已恢复示例数据')
  }, [pushToast])

  /* ---------------- Auth: Register ---------------- */
  const registerUser = useCallback(async (username, password, profile) => {
    const accounts = loadAccounts()
    if (accounts[username]) return false

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

    // Initialize fresh data for new user & switch to it
    const freshData = loadUserData(username)
    setData({
      ...freshData,
      settings: loadGlobalSettings(),
    })
    return true
  }, [])

  /* ---------------- Auth: Login ---------------- */
  const loginUserWithPassword = useCallback(async (username, password) => {
    const accounts = loadAccounts()
    const account = accounts[username]
    if (!account) return false

    const hashedInput = await hashPassword(password)
    if (hashedInput !== account.passwordHash) return false

    // Load THIS user's data (isolated from other users)
    const userData = loadUserData(username)
    setData({
      ...userData,
      isLoggedIn: true,
      currentUser: username,
      settings: loadGlobalSettings(),
    })
    return true
  }, [])

  /* ---------------- User Profile editing ---------------- */
  const loginUser = useCallback((profile) => {
    setData((d) => ({ ...d, isLoggedIn: true, user: { ...d.user, ...profile } }))
    pushToast('欢迎回来，开始今日成长 🎉')
  }, [pushToast])

  const updateUser = useCallback((patch) => {
    setData((d) => {
      const newUser = { ...d.user, ...patch }
      // Sync back to account storage
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
    setData((d) => ({
      ...initialData,
      settings: d.settings || loadGlobalSettings(),
      isLoggedIn: false,
      currentUser: '',
    }))
    setProfileOpen(false)
    pushToast('已退出登录')
  }, [pushToast])

  const openProfile = useCallback(() => setProfileOpen(true), [])
  const closeProfile = useCallback(() => setProfileOpen(false), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  /* ---------------- Settings ---------------- */
  const updateSettings = useCallback((patch) => {
    setData((d) => ({
      ...d,
      settings: { ...(d.settings || {}), ...patch },
    }))
  }, [])

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
    settingsOpen,
    openSettings,
    closeSettings,
    updateSettings,
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
    // export/import
    exportAllData,
    importAllData,
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
