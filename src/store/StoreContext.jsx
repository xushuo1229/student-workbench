import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'
import { supabase, USER_DATA_TABLE, USERS_TABLE, hashPassword, verifyPassword } from '../lib/supabase'

/* ---- Local storage keys ---- */
const LOCAL_SETTINGS_KEY = 'student-workbench-settings'
const LOCAL_CACHE_PREFIX = 'student-workbench-cache-'
const LOCAL_SESSION_KEY = 'student-workbench-session' // { userId, username, mode: 'cloud' | 'local' }
const LOCAL_ACCOUNTS_KEY = 'student-workbench-accounts' // legacy + fallback
const LOCAL_DATA_KEY = 'student-workbench-v1' // legacy data key

const StoreContext = createContext(null)

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

  // Check existing — 网络/表缺失视为云端不可用（返回 null 触发本地降级）
  let existing = null
  try {
    const { data } = await supabase
      .from(USERS_TABLE)
      .select('id')
      .eq('username', username)
      .maybeSingle()
    existing = data
  } catch (e) {
    return null // 网络错误 → 云端不可用
  }
  if (existing) throw new Error('该用户名已被注册')

  // Insert — 业务错误（唯一约束等）直接抛出；网络错误降级
  try {
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

    if (error) throw new Error('该用户名已被注册')
    return newUser
  } catch (e) {
    if (e.message === '该用户名已被注册') throw e
    return null // 网络/其他错误 → 降级本地
  }
}

async function cloudLoginUser(username, passwordHash) {
  if (!supabase) return null

  const { data: userRow, error } = await supabase
    .from(USERS_TABLE)
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (error) return null // 网络/表缺失 → 云端不可用
  if (!userRow) return null // 云端无此用户 → 交给本地兜底
  if (userRow.password_hash !== passwordHash) throw new Error('密码错误')

  return userRow
}

/* 备份合并：对象浅合并 + 列表按 id 深度合并（保留现有记录，补充备份中新的） */
const LIST_KEYS = ['plans', 'courses', 'readings', 'english', 'sports', 'weeklyPlan']

function mergeAppData(existing, incoming) {
  const out = { ...(existing || {}), ...(incoming || {}) }
  for (const key of LIST_KEYS) {
    const a = (existing && existing[key]) || []
    const b = (incoming && incoming[key]) || []
    if (!Array.isArray(a) || !Array.isArray(b)) {
      out[key] = Array.isArray(b) ? b : []
      continue
    }
    const ids = new Set(a.map((x) => x && x.id).filter(Boolean))
    out[key] = [...a, ...b.filter((x) => x && !ids.has(x.id))]
  }
  return out
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
  const [syncState, setSyncState] = useState('idle') // 'idle' | 'syncing' | 'synced' | 'offline' | 'local'

  const userIdRef = useRef(null)
  const cloudSyncTimer = useRef(null)
  const cloudRetryTimer = useRef(null)
  const isCloudMode = useRef(false)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

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

  // ---- Auto-sync to cloud on data changes (debounced + offline retry) ----
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

      // Try cloud sync
      if (isCloudMode.current) {
        setSyncState('syncing')
        const ok = await pushCloudData(userId, data)
        setSyncState(ok ? 'synced' : 'offline')
        if (!ok) {
          // 同步失败：30s 后自动重试一次（防抖期间的新变更会重新触发本流程）
          if (cloudRetryTimer.current) clearTimeout(cloudRetryTimer.current)
          cloudRetryTimer.current = setTimeout(async () => {
            setSyncState('syncing')
            const retryOk = await pushCloudData(userIdRef.current, dataRef.current)
            setSyncState(retryOk ? 'synced' : 'offline')
          }, 30000)
        }
      } else {
        setSyncState('local')
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

  /* 清空当前账号全部记录（保留个人资料与设置），云端同步清空 */
  const clearAllData = useCallback(async () => {
    const empty = {
      ...initialData,
      plans: [],
      courses: [],
      readings: [],
      english: [],
      sports: [],
      weeklyPlan: [],
    }
    setData((d) => ({
      ...empty,
      isLoggedIn: true,
      currentUser: d.currentUser,
      user: d.user,
      settings: d.settings || loadLocalSettings(),
    }))
    if (isCloudMode.current && userIdRef.current) {
      setSyncState('syncing')
      const ok = await pushCloudData(userIdRef.current, { ...empty, isLoggedIn: true, currentUser: data.currentUser })
      setSyncState(ok ? 'synced' : 'offline')
    }
    pushToast('已清空全部记录')
  }, [pushToast, data.currentUser])

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
        // 业务错误（用户名已注册等）透传给 UI；仅云端不可用时降级本地
        if (e.message === '该用户名已被注册') throw e
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

    // 兼容校验：带盐哈希优先，旧版无盐哈希兜底
    const passOk = await verifyPassword(password, account.passwordHash)
    if (!passOk) {
      throw new Error('密码错误，请重试')
    }

    // 旧格式哈希自动升级为带盐哈希
    const newHash = await hashPassword(password)
    if (account.passwordHash !== newHash) {
      accounts[username] = { ...account, passwordHash: newHash }
      saveAccounts(accounts)
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
    if (cloudRetryTimer.current) clearTimeout(cloudRetryTimer.current)
    cloudRetryTimer.current = null
    clearSession()
    setSyncState('idle')
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

    // 以内存中的最新数据为准（云同步可能有延迟，读内存最可靠）
    const appData = data
    const localSettings = loadLocalSettings()
    const accounts = loadAccounts()
    const account = accounts[session.username] || null

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: session.mode === 'cloud' ? 'supabase-custom' : 'local',
      userId: session.userId,
      username: session.username,
      appData,
      settings: localSettings,
      account,
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
      mergedData = mergeAppData(existing, jsonObj.appData || {})
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
    clearAllData,
    exportAllData,
    importAllData,
    syncState,
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
