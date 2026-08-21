import { clsx } from '../../lib/clsx'
import { isImageAvatar } from '../../lib/avatar'

/* Unified avatar renderer: shows an uploaded/remote image when `value` is a
   data/http URL, otherwise the emoji/text. Used everywhere a user avatar shows. */
export function Avatar({ value, size = 40, className = '' }) {
  const isImg = isImageAvatar(value)
  const style = { width: size, height: size }

  if (isImg) {
    return (
      <img
        src={value}
        alt="头像"
        style={style}
        className={clsx('shrink-0 rounded-2xl object-cover', className)}
      />
    )
  }

  return (
    <div
      style={{ ...style, fontSize: Math.round(size * 0.5) }}
      className={clsx('flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 leading-none', className)}
    >
      {value || '🙂'}
    </div>
  )
}
