// Minimal classnames helper (no external dependency)
export function clsx(...args) {
  const out = []
  for (const a of args) {
    if (!a) continue
    if (typeof a === 'string' || typeof a === 'number') {
      out.push(a)
    } else if (Array.isArray(a)) {
      const inner = clsx(...a)
      if (inner) out.push(inner)
    } else if (typeof a === 'object') {
      for (const key in a) {
        if (a[key]) out.push(key)
      }
    }
  }
  return out.join(' ')
}
