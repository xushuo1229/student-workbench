import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, LogOut, Pencil, Check, User as UserIcon } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Button } from './ui/Modal'
import { clsx } from '../lib/clsx'

const AVATARS = ['🍊', '🐱', '🐰', '🦊', '🐼', '🌟', '🍎', '🌈', '🐻', '🦄', '🐯', '🌸']
const GRADES = ['大一', '大二', '大三', '大四', '研究生', '其他']

function UserFields({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label-base">选择头像</p>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setForm({ ...form, avatar: a })}
              className={clsx(
                'flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition',
                form.avatar === a
                  ? 'border-brand-400 bg-brand-100 ring-4 ring-brand-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label-base">昵称</label>
        <input
          className="input-base"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="你的昵称"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base">年级</label>
          <select
            className="input-base"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          >
            <option value="">不填</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-base">专业</label>
          <input
            className="input-base"
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
            placeholder="如：计算机"
          />
        </div>
      </div>

      <div>
        <label className="label-base">学校</label>
        <input
          className="input-base"
          value={form.school}
          onChange={(e) => setForm({ ...form, school: e.target.value })}
          placeholder="你的学校"
        />
      </div>

      <div>
        <label className="label-base">个性签名 / 座右铭</label>
        <input
          className="input-base"
          value={form.motto}
          onChange={(e) => setForm({ ...form, motto: e.target.value })}
          placeholder="每天进步一点点"
        />
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50/70 px-4 py-2.5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="max-w-[60%] truncate text-sm font-medium text-slate-700">{value || '—'}</span>
    </div>
  )
}

export function ProfileModal({ mode = 'manage' }) {
  const { data, profileOpen, closeProfile, updateUser, logoutUser } = useStore()
  const show = mode === 'manage' && profileOpen
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...data.user })

  useEffect(() => {
    setForm({ ...data.user })
    setEditing(false)
  }, [data.user, profileOpen])

  if (!show) return null

  const summary = [data.user.grade, data.user.major, data.user.school].filter(Boolean).join(' · ')

  const handleSubmit = () => {
    const name = (form.name || '').trim()
    if (!name) {
      setForm({ ...form, name: data.user.name || '同学' })
      return
    }
    updateUser(form)
    setEditing(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-fade-in" />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-4xl border border-white/70 bg-white/95 shadow-soft animate-pop-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-2xl">
              {data.user.avatar}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{data.user.name}</h2>
              <p className="text-xs text-slate-400">{summary || '我的个人资料'}</p>
            </div>
          </div>
          <button
            onClick={closeProfile}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
          {editing ? (
            <UserFields form={form} setForm={setForm} />
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-col items-center py-2">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-100 text-4xl shadow-glass">
                  {data.user.avatar}
                </div>
                <p className="mt-3 text-lg font-bold text-slate-800">{data.user.name}</p>
                {data.data?.currentUser && (
                  <p className="mt-0.5 text-xs text-slate-400">@{data.currentUser}</p>
                )}
                {data.user.motto && (
                  <p className="mt-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                    "{data.user.motto}"
                  </p>
                )}
              </div>
              <InfoRow label="用户名" value={data.currentUser || '—'} />
              <InfoRow label="年级" value={data.user.grade} />
              <InfoRow label="专业" value={data.user.major} />
              <InfoRow label="学校" value={data.user.school} />
              <InfoRow label="个性签名" value={data.user.motto} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => { setForm({ ...data.user }); setEditing(false) }}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                <Check size={16} /> 保存
              </Button>
            </>
          ) : (
            <>
              <Button variant="danger" onClick={logoutUser}>
                <LogOut size={16} /> 退出登录
              </Button>
              <Button onClick={() => setEditing(true)}>
                <Pencil size={16} /> 编辑资料
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
