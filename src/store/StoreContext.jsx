import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'

/* ---- Supabase (optional — graceful fallback if unavailable) ---- */
let supabase = null
let USER_DATA_TABLE = 'user_data'
let USERS_TABLE = 'wb_users'
try {
  const sb = require('@supabase/supabase-js')
  supabase = sb.createClient(
    'https://gidbmdeawvxpfudcvoxfg.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmVzIiwicm9sZSI6ImFub24iLCJleHAiOjE5NjM4MDczODZ9',
  )
} catch (e) {
  /* Supabase not available — pure local mode */
}

/* ---- Local storage keys ---- */
const LOCAL_SETTINGS_KEY = 'student-workbench-settings'
const LOCAL_CACHE_PREFIX = 'student-workbench-cache-'
const LOCAL_SESSION_KEY = 'student-workbench-session' // { userId, username, mode: 'cloud' | 'local' }
const LOCAL_ACCOUNTS_KEY = 'student-workbench-accounts' // legacy + fallback
const LOCAL_DATA_KEY = 'student-workbench-v1' // legacy data key

const StoreContext = createContext(null)

/* ---- SHA-256 password hashing ---- */
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/* ---- Local settings (background etc, shared across users) ---- */
function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return initialData.settings || {}
}

function saveLocalSettings(settings) {
  try { localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings)) } catch (e) { /* ignore */ }
}

/* ---- Local cache for offline use ---- */
function getLocalCache(userId) {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_PREFIX + userId)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function setLocalCache(userId, data) {
  try { localStorage.setItem(LOCAL_CACHE_PREFIX + userId, JSON.stringify(data)) } catch (e) { /* ignore */ }
}

/* ---- Session ---- */
function loadSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function saveSession(userId, username, mode = 'cloud') {
  try { localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId, username, mode })) } catch (e) { /* ignore */ }
}

function clearSession() {
  try { localStorage.removeItem(LOCAL_SESSION_KEY) } catch (e) { /* ignore */ }
}

/* ---- Legacy accounts (localStorage-based auth) ---- */
function loadAccounts() {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return {}
}

function saveAccounts(accounts) {
  try { localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts)) } catch (e) { /* ignore */ }
}

/* ---- Legacy per-user data key ---- */
function userDataKey(username) {
  return `student-workbench-data-${username}`
}

function loadUserData(username) {
  try {
    const raw = localStorage.getItem(userDataKey(username))
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function saveUserData(username, data) {
  try { localStorage.setItem(userDataKey(username), JSON.stringify(data)) } catch (e) { /* ignore */ }
}

/* ---- Cloud helpers (safe to call even without Supabase) ---- */
async function fetchCloudData(userId) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from(USER_DATA_TABLE)
      .select('data')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    return data.data
  } catch (e) {
    return null // Network error or table doesn't exist → fallback
  }
}

async function pushCloudData(userId, appData) {
  if (!supabase) return false
  try {
    const { isLoggedIn, currentUser, settings, ...cleanData } = appData
    const { error } = await supabase
      .from(USER_DATA_TABLE)
      .upsert(
        { user_id: userId, data: cleanData, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    return !error
  } catch (e) {
    return false // Silently fail — local still works
  }
}

async function cloudRegisterUser(username, passwordHash, profile) {
  if (!supabase) return null

  // Check existing
  const { data: existing } = await supabase
    .from(USERS_TABLE)
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) throw new Error('该用户名已被注册')

  // Insert
  const { data: newUser, error } = await supabase
    .from(USERS_TABLE)
    .insert({
      username,
      password_hash: passwordHash,
      display_name: profile.name || username,
      avatar: profile.avatar || '🍊',
      school: profile.school || '',
      major: profile.major || '',
      grade: profile.grade || '',
      motto: profile.motto || '',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return newUser
}

async function cloudLoginUser(username, passwordHash) {
  if (!supabase) return null

  const { data: userRow, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (error) throw new Error('登录失败，请检查网络')
  if (!userRow) return null // User not found in cloud
  if (userRow.password_hash !== passwordHash) throw new Error('密码错误')

  return userRow
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(() => ({
    ...initialData,
    settings: loadLocalSettings(),
  }))
  const [activePage, setActivePage] = useState('home')
  const [toasts, setToasts] = useState([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const userIdRef = useRef(null)
  const cloudSyncTimer = useRef(null)
  const isCloudMode = useRef(false)

  // ---- On mount: restore session ----
  useEffect(() => {
    const session = loadSession()
    if (session?.userId && session?.username) {
      userIdRef.current = session.userId
      isCloudMode.current = session.mode === 'cloud'
      loadUserDataFromSource(session.userId, session.username, session.mode)
    }
  }, [])

  // ---- Load user data: cloud first, local fallback ----
  async function loadUserDataFromSource(userId, username, mode) {
    let userData = null

    if (mode === 'cloud') {
      userData = await fetchCloudData(userId)
    }

    // Fallback: local cache / legacy data
    if (!userData) {
      userData = getLocalCache(userId) || loadUserData(username)
    }

    if (userData) {
      setData((d) => ({
        ...userData,
        isLoggedIn: true,
        currentUser: username || userData.user?.name || '',
        settings: d.settings || loadLocalSettings(),
      }))
    } else {
      const fresh = { ...initialData, isLoggedIn: true, currentUser: username || '' }
      setData((d) => ({ ...fresh, settings: d.settings || loadLocalSettings() }))
    }
  }

  // ---- Auto-sync to cloud on data changes (debounced) ----
  useEffect(() => {
    if (!userIdRef.current || !data.isLoggedIn) return
    if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current)

    cloudSyncTimer.current = setTimeout(async () => {
      const userId = userIdRef.current
      if (!userId) return

      // Always save locally
      setLocalCache(userId, data)
      if (!isCloudMode.current && data.currentUser) {
        saveUserData(data.currentUser, data)
      }

      // Try cloud sync (silent fail)
      if (isCloudMode.current) {
        await pushCloudData(userId, data)
      }
    }, 800)

    if (data.settings) saveLocalSettings(data.settings)

    return () => {
      if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current)
    }
  }, [data])

  const pushToast = useCallback((message, type = 'success') => {
    const id = uid()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  /* ==================== DATA OPERATIONS ==================== */

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
    setData((d) => ({ ...initialData, settings: d.settings || loadLocalSettings() }))
    pushToast('已恢复示例数据')
  }, [pushToast])

  /* ==================== AUTH: Register (hybrid: cloud first → local fallback) ==================== */
  const registerUser = useCallback(async (username, password, profile) => {
    const passwordHash = await hashPassword(password)

    // Strategy 1: Try Supabase cloud registration
    if (supabase) {
      try {
        const newUser = await cloudRegisterUser(username, passwordHash, profile)
        if (newUser) {
          // Cloud success!
          userIdRef.current = newUser.id
          isCloudMode.current = true
          saveSession(newUser.id, username, 'cloud')

          const freshData = {
            ...initialData,
            isLoggedIn: true,
            currentUser: username,
            user: {
              name: profile.name || username,
              avatar: profile.avatar || '🍊',
              school: profile.school || '',
              major: profile.major || '',
              grade: profile.grade || '',
              motto: profile.motto || '',
            },
          }
          setData((d) => ({ ...freshData, settings: d.settings || loadLocalSettings() }))
          return true
        }
      } catch (e) {
        // Cloud failed (table missing, network error, etc.) → fall through to local
        console.warn('Cloud register failed, falling back to local:', e.message)
      }
    }

    // Strategy 2: Fallback to localStorage accounts
    const accounts = loadAccounts()
    if (accounts[username]) {
      throw new Error('该用户名已被注册，请换一个或直接登录')
    }

    // Save account
    accounts[username] = { passwordHash, ...profile }
    saveAccounts(accounts)

    // Generate a stable local ID for this user
    const localUserId = `local_${username}_${Date.now()}`
    userIdRef.current = localUserId
    isCloudMode.current = false
    saveSession(localUserId, username, 'local')

    const freshData = {
      ...initialData,
      isLoggedIn: true,
      currentUser: username,
      user: {
        name: profile.name || username,
        avatar: profile.avatar || '🍊',
        school: profile.school || '',
        major: profile.major || '',
        grade: profile.grade || '',
        motto: profile.motto || '',
      },
    }
    setData((d) => ({ ...freshData, settings: d.settings || loadLocalSettings() }))
    return true
  }, [pushToast])

  /* ==================== AUTH: Login (hybrid: cloud first → local fallback) ==================== */
  const loginUserWithPassword = useCallback(async (username, password) => {
    const passwordHash = await hashPassword(password)

    // Strategy 1: Try Supabase cloud login
    if (supabase) {
      try {
        const userRow = await cloudLoginUser(username, passwordHash)
        if (userRow) {
          // Cloud login success!
          userIdRef.current = userRow.id
          isCloudMode.current = true
          saveSession(userRow.id, username, 'cloud')

          const cloudAppData = await fetchCloudData(userRow.id)
          const cachedData = getLocalCache(userRow.id)
          const appData = cloudAppData || cachedData

          setData((d) => ({
            ...(appData || initialData),
            isLoggedIn: true,
            currentUser: username,
            user: {
              name: userRow.display_name || username,
              avatar: userRow.avatar || '🍊',
              school: userRow.school || appData?.user?.school || '',
              major: userRow.major || appData?.user?.major || '',
              grade: userRow.grade || appData?.user?.grade || '',
              motto: userRow.motto || appData?.user?.motto || '',
            },
            settings: d.settings || loadLocalSettings(),
          }))
          return true
        }
        // userRow = null means user not found in cloud → check local below
      } catch (e) {
        // Cloud error (network, table missing) → fall through to local
        console.warn('Cloud login failed, trying local:', e.message)
      }
    }

    // Strategy 2: Fallback to localStorage accounts
    const accounts = loadAccounts()
    const account = accounts[username]

    if (!account) {
      throw new Error('账号不存在或密码错误，请先注册')
    }

    if (account.passwordHash !== passwordHash) {
      throw new Error('密码错误，请重试')
    }

    // Local login success!
    const localUserId = `local_${username}`
    userIdRef.current = localUserId
    isCloudMode.current = false
    saveSession(localUserId, username, 'local')

    // Load user's local data
    const localAppData = loadUserData(username)

    setData((d) => ({
      ...(localAppData || initialData),
      isLoggedIn: true,
      currentUser: username,
      user: {
        name: account.name || username,
        avatar: account.avatar || '🍊',
        school: account.school || localAppData?.user?.school || '',
        major: account.major || localAppData?.user?.major || '',
        grade: account.grade || localAppData?.user?.grade || '',
        motto: account.motto || localAppData?.user?.motto || '',
      },
      settings: d.settings || loadLocalSettings(),
    }))
    return true
  }, [pushToast])

  /* ==================== Profile editing ==================== */
  const loginUser = useCallback((profile) => {
    setData((d) => ({ ...d, isLoggedIn: true, user: { ...d.user, ...profile } }))
    pushToast('欢迎回来，开始今日成长 🎉')
  }, [pushToast])

  const updateUser = useCallback(async (patch) => {
    const newUser = { ...data.user, ...patch }

    // Try updating in cloud
    if (isCloudMode.current && userIdRef.current && supabase) {
      try {
        await supabase.from(USERS_TABLE).update({
          display_name: newUser.name,
          avatar: newUser.avatar,
          school: newUser.school,
          major: newUser.major,
          grade: newUser.grade,
          motto: newUser.motto,
        }).eq('id', userIdRef.current)
      } catch (e) { /* silent fail */ }
    }

    // Always update locally
    if (data.currentUser) {
      const accounts = loadAccounts()
      if (accounts[data.currentUser]) {
        accounts[data.currentUser] = { ...accounts[data.currentUser], ...patch }
        saveAccounts(accounts)
      }
    }

    setData((d) => ({ ...d, user: newUser }))
    pushToast('资料已更新')
  }, [pushToast, data.user, data.currentUser])

  const logoutUser = useCallback(async () => {
    userIdRef.current = null
    isCloudMode.current = false
    clearSession()
    setData((d) => ({
      ...initialData,
      settings: d.settings || loadLocalSettings(),
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

  /* ==================== Settings ==================== */
  const updateSettings = useCallback((patch) => {
    setData((d) => ({
      ...d,
      settings: { ...(d.settings || {}), ...patch },
    }))
  }, [])

  /* ==================== Export / Import ==================== */
  const exportAllData = useCallback(async () => {
    const session = loadSession()
    if (!session?.username) throw new Error('请先登录')

    let appData = null
    if (session.mode === 'cloud' && session.userId) {
      appData = await fetchCloudData(session.userId)
    }
    if (!appData) {
      appData = loadUserData(session.username) || data
    }

    const localSettings = loadLocalSettings()

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: session.mode === 'cloud' ? 'supabase-custom' : 'local',
      userId: session.userId,
      username: session.username,
      appData,
      settings: localSettings,
    }
  }, [data])

  const importAllData = useCallback(async (jsonObj, mode = 'merge') => {
    if (!jsonObj || jsonObj.version === undefined) throw new Error('无效的备份文件格式')

    const session = loadSession()
    if (!session?.username) throw new Error('请先登录')

    let mergedData
    if (mode === 'overwrite') {
      mergedData = jsonObj.appData || {}
    } else {
      let existing = session.mode === 'cloud' && session.userId
        ? await fetchCloudData(session.userId)
        : null
      if (!existing) existing = loadUserData(session.username)
      mergedData = { ...(existing || {}), ...(jsonObj.appData || {}) }
    }

    // Save imported data
    if (session.mode === 'cloud' && session.userId) {
      await pushCloudData(session.userId, { ...mergedData, isLoggedIn: true, currentUser: session.username })
    }
    saveUserData(session.username, mergedData)
    if (session.userId) setLocalCache(session.userId, mergedData)

    // Apply to state
    setData((d) => ({
      ...mergedData,
      isLoggedIn: true,
      currentUser: session.username,
      settings: jsonObj.settings ? { ...loadLocalSettings(), ...jsonObj.settings } : (d.settings || loadLocalSettings()),
    }))

    if (jsonObj.settings) {
      saveLocalSettings({ ...loadLocalSettings(), ...jsonObj.settings })
    }

    return 1
  }, [data.currentUser])

  const value = {
    data,
    activePage,
    setActivePage,
    toasts,
    pushToast,
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
    addPlan, updatePlan, deletePlan, togglePlan,
    addCourse, updateCourse, deleteCourse, addNote, deleteNote,
    addReading, updateReading, deleteReading,
    addEnglish, updateEnglish, deleteEnglish,
    addSport, updateSport, deleteSport,
    addWeekly, updateWeekly, deleteWeekly, toggleWeekly,
    resetAll,
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
