import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'
import { supabase, USER_DATA_TABLE, USERS_TABLE } from '../lib/supabase'

/* ---- Local storage keys ---- */
const LOCAL_SETTINGS_KEY = 'student-workbench-settings'
const LOCAL_CACHE_PREFIX = 'student-workbench-cache-'
const LOCAL_SESSION_KEY = 'student-workbench-session' // { userId, username }

const StoreContext = createContext(null)

/* ---- SHA-256 password hashing (client-side) ---- */
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

/* ---- Session (login state) ---- */
function loadSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

function saveSession(userId, username) {
  try { localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ userId, username })) } catch (e) { /* ignore */ }
}

function clearSession() {
  try { localStorage.removeItem(LOCAL_SESSION_KEY) } catch (e) { /* ignore */ }
}

/* ---- Cloud: read user's app data from Supabase ---- */
async function fetchCloudData(userId) {
  const { data, error } = await supabase
    .from(USER_DATA_TABLE)
    .select('data')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data.data
}

/* ---- Cloud: upsert user's app data to Supabase ---- */
async function pushCloudData(userId, appData) {
  const { isLoggedIn, currentUser, settings, ...cleanData } = appData

  const { error } = await supabase
    .from(USER_DATA_TABLE)
    .upsert(
      {
        user_id: userId,
        data: cleanData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  return !error
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

  // Track current user ID for cloud operations
  const userIdRef = useRef(null)
  const cloudSyncTimer = useRef(null)

  // ---- On mount: restore session from local storage ----
  useEffect(() => {
    const session = loadSession()
    if (session?.userId) {
      userIdRef.current = session.userId
      loadUserDataFromSource(session.userId, session.username)
    }
  }, [])

  // ---- Load user data: cloud first, local cache fallback ----
  async function loadUserDataFromSource(userId, username) {
    let userData = await fetchCloudData(userId)
    if (!userData) userData = getLocalCache(userId)

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
      setLocalCache(userId, data)
      await pushCloudData(userId, data)
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

  /* ==================== AUTH: Register (custom users table) ==================== */
  const registerUser = useCallback(async (username, password, profile) => {
    const passwordHash = await hashPassword(password)

    // Check if username already exists
    const { data: existing } = await supabase
      .from(USERS_TABLE)
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      throw new Error('该用户名已被注册，请换一个或直接登录')
    }

    // Insert new user
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

    // Save session locally
    userIdRef.current = newUser.id
    saveSession(newUser.id, username)

    // Set state
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

  /* ==================== AUTH: Login (custom users table) ==================== */
  const loginUserWithPassword = useCallback(async (username, password) => {
    const passwordHash = await hashPassword(password)

    // Fetch user by username
    const { data: userRow, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('username', username)
      .maybeSingle()

    if (error) throw new Error('登录失败，请检查网络')
    if (!userRow) throw new Error('账号不存在，请先注册')

    if (userRow.password_hash !== passwordHash) {
      throw new Error('密码错误，请重试')
    }

    // Success — save session
    userIdRef.current = userRow.id
    saveSession(userRow.id, username)

    // Load app data
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
  }, [pushToast])

  /* ==================== Profile editing ==================== */
  const loginUser = useCallback((profile) => {
    setData((d) => ({ ...d, isLoggedIn: true, user: { ...d.user, ...profile } }))
    pushToast('欢迎回来，开始今日成长 🎉')
  }, [pushToast])

  const updateUser = useCallback(async (patch) => {
    const newUser = { ...data.user, ...patch }

    // Update profile in cloud (wb_users table)
    if (userIdRef.current) {
      await supabase
        .from(USERS_TABLE)
        .update({
          display_name: newUser.name,
          avatar: newUser.avatar,
          school: newUser.school,
          major: newUser.major,
          grade: newUser.grade,
          motto: newUser.motto,
        })
        .eq('id', userIdRef.current)
    }

    setData((d) => ({ ...d, user: newUser }))
    pushToast('资料已更新')
  }, [pushToast, data.user])

  const logoutUser = useCallback(async () => {
    userIdRef.current = null
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
    if (!session?.userId) throw new Error('请先登录')

    const cloudData = await fetchCloudData(session.userId)
    const localSettings = loadLocalSettings()

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'supabase-custom',
      userId: session.userId,
      appData: cloudData || {},
      settings: localSettings,
    }
  }, [])

  const importAllData = useCallback(async (jsonObj, mode = 'merge') => {
    if (!jsonObj || jsonObj.version === undefined) throw new Error('无效的备份文件格式')

    const session = loadSession()
    if (!session?.userId) throw new Error('请先登录')

    let mergedData
    if (mode === 'overwrite' || !userIdRef.current) {
      mergedData = jsonObj.appData || {}
    } else {
      const existing = await fetchCloudData(session.userId)
      mergedData = { ...(existing || {}), ...(jsonObj.appData || {}) }
    }

    await pushCloudData(session.userId, {
      ...mergedData,
      isLoggedIn: true,
      currentUser: data.currentUser,
    })

    await loadUserDataFromSource(session.userId, session.username)
    localStorage.setItem(LOCAL_CACHE_PREFIX + session.userId, JSON.stringify(mergedData))

    if (jsonObj.settings) {
      saveLocalSettings({ ...loadLocalSettings(), ...jsonObj.settings })
      setData((d) => ({ ...d, settings: { ...(d.settings || {}), ...jsonObj.settings } }))
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
