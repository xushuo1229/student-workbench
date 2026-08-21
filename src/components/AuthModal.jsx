import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, LogIn, UserPlus, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Button } from './ui/Modal'
import { clsx } from '../lib/clsx'

const AVATARS = ['🍊', '🐱', '🐰', '🦊', '🐼', '🌟', '🍎', '🌈', '🐻', '🦄', '🐯', '🌸']
const GRADES = ['大一', '大二', '大三', '大四', '研究生', '其他']

/* Simple hash for localStorage — NOT cryptographically secure,
   but sufficient to prevent plaintext passwords in browser storage. */
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '_swb_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AuthModal() {
  const { data, registerUser, loginUserWithPassword, pushToast } = useStore()
  const show = !data.isLoggedIn

  // 'login' | 'register' | 'profile'
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login fields
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [showLoginPass, setShowLoginPass] = useState(false)

  // Register fields
  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    avatar: '🍊',
    grade: '',
    major: '',
    school: '',
    motto: '',
  })
  const [showRegPass, setShowRegPass] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (show) {
      setMode('login')
      setError('')
      setLoginUser('')
      setLoginPass('')
      setRegForm({ username: '', password: '', confirmPassword: '', name: '', avatar: '🍊', grade: '', major: '', school: '', motto: '' })
    }
  }, [show])

  if (!show) return null

  /* ---- Login submit ---- */
  const handleLogin = async () => {
    setError('')
    if (!loginUser.trim()) { setError('请输入用户名'); return }
    if (!loginPass) { setError('请输入密码'); return }
    setLoading(true)
    try {
      const ok = await loginUserWithPassword(loginUser.trim(), loginPass)
      if (ok) {
        pushToast(`欢迎回来，${loginUser.trim()} 🎉`)
      } else {
        setError('用户名或密码错误')
      }
    } catch (e) {
      setError('登录失败，请重试')
    }
    setLoading(false)
  }

  /* ---- Register submit ---- */
  const handleRegister = async () => {
    setError('')
    const u = regForm.username.trim()
    const p = regForm.password
    const cp = regForm.confirmPassword
    if (!u) { setError('请输入用户名'); return }
    if (u.length < 2 || u.length > 20) { setError('用户名需 2-20 个字符'); return }
    if (!p) { setError('请设置密码'); return }
    if (p.length < 4) { setError('密码至少 4 位'); return }
    if (p !== cp) { setError('两次密码不一致'); return }

    setLoading(true)
    try {
      const profile = {
        name: regForm.name.trim() || u,
        avatar: regForm.avatar,
        grade: regForm.grade,
        major: regForm.major,
        school: regForm.school,
        motto: regForm.motto,
      }
      const ok = await registerUser(u, p, profile)
      if (ok) {
        pushToast(`注册成功，欢迎 ${profile.name} ✨`)
      } else {
        setError('该用户名已被注册')
      }
    } catch (e) {
      setError('注册失败，请重试')
    }
    setLoading(false)
  }

  /* ---- Render helpers ---- */

  function inputField(label, value, onChange, opts = {}) {
    const { type = 'text', placeholder, disabled, autoComplete } = opts
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">{label}</label>
        <input
          type={type}
          className="input-base"
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => { setError(''); onChange(e.target.value) }}
          onKeyDown={(e) => e.key === 'Enter' && !loading && (mode === 'login' ? handleLogin() : handleRegister())}
        />
      </div>
    )
  }

  function passwordField(label, value, onChange, show, setShow, opts = {}) {
    const { placeholder, autoComplete } = opts
    return (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">{label}</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            className="input-base pr-10"
            value={value}
            autoComplete={autoComplete}
            placeholder={placeholder}
            onChange={(e) => { setError(''); onChange(e.target.value) }}
            onKeyDown={(e) => e.key === 'Enter' && !loading && (mode === 'login' ? handleLogin() : handleRegister())}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 transition hover:text-slate-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-100/90 via-white/80 to-blue-100/90 backdrop-blur-md" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-soft animate-pop-in sm:max-w-lg sm:rounded-4xl">

        {/* Header */}
        <div className="px-5 pt-6 pb-2 text-center sm:px-6 sm:pt-7">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-100 text-3xl shadow-glass sm:h-16 sm:w-16 sm:text-4xl">
            {mode === 'register' ? (regForm.avatar || '🙂') : '🔐'}
          </div>
          <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
            {mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : '完善资料'}
          </h2>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            {mode === 'login' ? '登录你的自律工作台账号' : mode === 'register' ? '填写信息开始你的成长之旅' : '让工作台更了解你'}
          </p>

          {/* Mode toggle tabs */}
          <div className="mx-auto mt-4 inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={clsx(
                'rounded-xl px-4 py-1.5 text-sm font-medium transition',
                mode === 'login' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <LogIn size={14} className="mr-1 inline" /> 登录
            </button>
            <button
              onClick={() => { setMode('register'); setError('') }}
              className={clsx(
                'rounded-xl px-4 py-1.5 text-sm font-medium transition',
                mode === 'register' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <UserPlus size={14} className="mr-1 inline" /> 注册
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 sm:mx-6">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4 sm:max-h-[60vh] sm:px-6 sm:py-5">
          {mode === 'login' && (
            <div className="space-y-4">
              {inputField('用户名', loginUser, setLoginUser, { placeholder: '输入你的用户名', autoComplete: 'username' })}
              {passwordField('密码', loginPass, setLoginPass, showLoginPass, setShowLoginPass, { placeholder: '输入密码', autoComplete: 'current-password' })}
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-4">
              {/* Avatar picker row */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">选择头像</label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setRegForm({ ...regForm, avatar: a })}
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition sm:h-11 sm:w-11 sm:text-xl',
                        regForm.avatar === a
                          ? 'border-brand-400 bg-brand-100 ring-4 ring-brand-100'
                          : 'border-slate-200 bg-white hover:bg-slate-50',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {inputField('用户名 *', regForm.username, (v) => setRegForm({ ...regForm, username: v }), { placeholder: '2-20个字符', autoComplete: 'username' })}
                {inputField('昵称', regForm.name, (v) => setRegForm({ ...regForm, name: v }), { placeholder: '显示名称（可选）', autoComplete: 'nickname' })}
              </div>

              {passwordField('密码 *', regForm.password, (v) => setRegForm({ ...regForm, password: v }), showRegPass, setShowRegPass, { placeholder: '至少4位', autoComplete: 'new-password' })}
              {passwordField('确认密码 *', regForm.confirmPassword, (v) => setRegForm({ ...regForm, confirmPassword: v }), showRegConfirm, setShowRegConfirm, { placeholder: '再次输入密码', autoComplete: 'new-password' })}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">年级</label>
                  <select
                    className="input-base"
                    value={regForm.grade}
                    onChange={(e) => setRegForm({ ...regForm, grade: e.target.value })}
                  >
                    <option value="">不填</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {inputField('专业', regForm.major, (v) => setRegForm({ ...regForm, major: v }), { placeholder: '如：计算机' })}
              </div>

              {inputField('学校', regForm.school, (v) => setRegForm({ ...regForm, school: v }), { placeholder: '你的学校（可选）' })}
              {inputField('座右铭', regForm.motto, (v) => setRegForm({ ...regForm, motto: v }), { placeholder: '每天进步一点点' })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          {mode === 'login' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setMode('register')}
                className="sm:hidden"
              >
                去注册
              </Button>
              <Button onClick={handleLogin} disabled={loading}>
                {loading ? '登录中...' : <><LogIn size={16} /> 登 录</>}
              </Button>
            </>
          )}
          {mode === 'register' && (
            <>
              <Button variant="ghost" onClick={() => setMode('login')}>
                返回登录
              </Button>
              <Button onClick={handleRegister} disabled={loading}>
                {loading ? '注册中...' : <><Sparkles size={16} /> 注 册</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
