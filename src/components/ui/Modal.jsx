import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from '../../lib/clsx'

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={clsx(
          'relative z-10 w-full overflow-hidden rounded-4xl border border-white/70 bg-white/95 shadow-soft animate-pop-in',
          sizeMap[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  const variants = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-200',
    soft: 'bg-brand-100 text-brand-700 hover:bg-brand-200',
    ghost: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    outline: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-xl',
    md: 'px-4 py-2.5 text-sm rounded-2xl',
    lg: 'px-5 py-3 text-sm rounded-2xl',
  }
  return (
    <button
      className={clsx('inline-flex items-center justify-center gap-1.5 font-medium transition disabled:opacity-50', variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}
