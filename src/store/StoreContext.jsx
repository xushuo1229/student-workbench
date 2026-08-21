import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { initialData } from '../data/initialData'
import { uid } from '../lib/format'
import { supabase, USER_DATA_TABLE } from '../lib/supabase'

/* ---- Local storage keys (kept as offline fallback) ---- */
const LOCAL_SETTINGS_KEY = 'student-workbench-settings'
const LOCAL_CACHE_PREFIX = 'student-workbench-cache-'

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
  // Strip transient fields before saving
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

  // ---- Auth state listener: auto-login on page refresh ----
  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        userIdRef.current = session.user.id
        loadUserDataFromSource(session.user.id)
      }
    })

    // Listen for auth changes (login/logout on other tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        userIdRef.current = session.user.id
        loadUserDataFromSource(session.user.id)
      } else {
        userIdRef.current = null
        setData((d) => ({ ...initialData, settings: d.settings || loadLocalSettings(), isLoggedIn: false, currentUser: '' }))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ---- Load user data: cloud first, local cache fallback ----
  async function loadUserDataFromSource(userId) {
    // Try cloud first
    let userData = await fetchCloudData(userId)

    if (!userData) {
      // Fallback to local cache
      userData = getLocalCache(userId)
    }

    if (userData) {
      setData((d) => ({
        ...userData,
        isLoggedIn: true,
        currentUser: userData.user?.name || '',
        settings: d.settings || loadLocalSettings(),
      }))
    } else {
      // Brand new user — start with fresh template
      const fresh = { ...initialData, isLoggedIn: true, currentUser: '' }
      setData((d) => ({ ...fresh, settings: d.settings || loadLocalSettings() }))
    }
  }

  // ---- Auto-sync to cloud on data changes (debounced) ----
  useEffect(() => {
    if (!userIdRef.current || !data.isLoggedIn) return

    // Debounce: wait 800ms after last change before pushing
    if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current)
    cloudSyncTimer.current = setTimeout(async () => {
      const userId = userIdRef.current
      if (!userId) return

      // Save to local cache (offline backup)
      setLocalCache(userId, data)

      // Push to cloud
      await pushCloudData(userId, data)
    }, 800)

    // Also persist settings locally always
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

  /* ==================== DATA OPERATIONS (same as before) ==================== */

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

  /* ==================== AUTH: Register (Supabase) ==================== */
  const registerUser = useCallback(async (username, password, profile) => {
    // Use email as username@workbench.local (Supabase needs email for auth)
    const email = `${username}@workbench.local`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: profile.name || username,
          avatar: profile.avatar || '🍊',
          school: profile.school || '',
          major: profile.major || '',
          grade: profile.grade || '',
          motto: profile.motto || '',
        },
        // Skip email redirect — we handle it client-side
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      // User already exists in auth — try logging in
      if (error.message?.includes('already registered') || error.status === 422) {
        return loginUserWithPassword(username, password)
      }
      throw new Error(error.message)
    }

    // Supabase v2 returns user even when email confirmation is required.
    // If session exists → auto-confirmed (or email confirm disabled). Use it.
    // If no session but user exists → email confirm is blocking.
    if (data.user) {
      if (data.session) {
        // Confirmed / auto-confirmed → full login
        userIdRef.current = data.user.id
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
      } else {
        // User created but not confirmed — try immediate sign-in
        // (works when "Confirm email" is turned OFF in Supabase settings)
        try {
          return await loginUserWithPassword(username, password)
        } catch {
          throw new Error('注册成功但需要邮箱验证。请在 Supabase 控制台关闭「Confirm email」设置，或直接用此账号登录。')
        }
      }
    }

    return false
  }, [])

  /* ==================== AUTH: Login (Supabase) ==================== */
  const loginUserWithPassword = useCallback(async (username, password) => {
    const email = `${username}@workbench.local`

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message?.includes('Invalid login') || error.message?.includes('Email not confirmed')) {
        // More helpful message
        throw new Error('账号不存在或密码错误。如果是首次使用云端版，请先点「注册」创建新账号。')
      }
      throw new Error(error.message)
    }

    if (data.user) {
      userIdRef.current = data.user.id

      // Load user's metadata from Supabase auth
      const meta = data.user.user_metadata || {}
      const displayName = meta.display_name || username

      // Load user's app data from cloud
      const cloudAppData = await fetchCloudData(data.user.id)
      const cachedData = getLocalCache(data.user.id)
      const appData = cloudAppData || cachedData

      setData((d) => ({
        ...(appData || initialData),
        isLoggedIn: true,
        currentUser: displayName,
        user: {
          name: displayName,
          avatar: meta.avatar || '🍊',
          school: meta.school || appData?.user?.school || '',
          major: meta.major || appData?.user?.major || '',
          grade: meta.grade || appData?.user?.grade || '',
          motto: meta.motto || appData?.user?.motto || '',
        },
        settings: d.settings || loadLocalSettings(),
      }))

      return true
    }

    return false
  }, [])

  /* ==================== Profile editing ==================== */
  const loginUser = useCallback((profile) => {
    setData((d) => ({ ...d, isLoggedIn: true, user: { ...d.user, ...profile } }))
    pushToast('欢迎回来，开始今日成长 🎉')
  }, [pushToast])

  const updateUser = useCallback(async (patch) => {
    const newUser = { ...data.user, ...patch }

    // Update Supabase auth metadata
    if (userIdRef.current) {
      await supabase.auth.updateUser({
        data: {
          display_name: newUser.name,
          avatar: newUser.avatar,
          school: newUser.school,
          major: newUser.major,
          grade: newUser.grade,
          motto: newUser.motto,
        },
      })
    }

    setData((d) => ({ ...d, user: newUser }))
    pushToast('资料已更新')
  }, [pushToast, data.user])

  const logoutUser = useCallback(async () => {
    await supabase.auth.signOut()
    userIdRef.current = null
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

  /* ==================== Export / Import (still works for backup) ==================== */
  const exportAllData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('请先登录')

    const cloudData = await fetchCloudData(user.id)
    const localSettings = loadLocalSettings()

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'supabase',
      userId: user.id,
      appData: cloudData || {},
      settings: localSettings,
    }
  }, [])

  const importAllData = useCallback(async (jsonObj, mode = 'merge') => {
    if (!jsonObj || jsonObj.version === undefined) throw new Error('无效的备份文件格式')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('请先登录')

    let mergedData
    if (mode === 'overwrite' || !userIdRef.current) {
      mergedData = jsonObj.appData || {}
    } else {
      // Merge: cloud data takes precedence for existing keys, import fills gaps
      const existing = await fetchCloudData(user.id)
      mergedData = { ...(existing || {}), ...(jsonObj.appData || {}) }
    }

    // Write merged data to cloud
    await pushCloudData(user.id, {
      ...mergedData,
      isLoggedIn: true,
      currentUser: data.currentUser,
    })

    // Reload from cloud
    await loadUserDataFromSource(user.id)

    // Import settings
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
    // ui modals
    profileOpen,
    openProfile,
    closeProfile,
    settingsOpen,
    openSettings,
    closeSettings,
    updateSettings,
    // auth (Supabase-based)
    registerUser,
    loginUserWithPassword,
    loginUser,
    updateUser,
    logoutUser,
    // data ops
    addPlan, updatePlan, deletePlan, togglePlan,
    addCourse, updateCourse, deleteCourse, addNote, deleteNote,
    addReading, updateReading, deleteReading,
    addEnglish, updateEnglish, deleteEnglish,
    addSport, updateSport, deleteSport,
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
