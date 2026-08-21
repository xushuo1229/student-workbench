import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Check } from 'lucide-react'
import { fmtTime } from '../../lib/format'
import { clsx } from '../../lib/clsx'
import { Button } from './Modal'

export function Timer({ accent = 'brand', onUse, useLabel = '使用本次时长', initialSeconds = 0, hint }) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!running) return
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(ref.current)
  }, [running])

  const start = () => setRunning(true)
  const pause = () => setRunning(false)
  const reset = () => {
    setRunning(false)
    setSeconds(0)
  }
  const use = () => {
    if (seconds <= 0) return
    onUse?.(seconds)
    reset()
  }

  const accentMap = {
    brand: 'text-brand-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    green: 'text-emerald-600',
  }

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">专注计时器</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div className={clsx('mt-2 font-mono text-5xl font-semibold tabular-nums', accentMap[accent])}>
        {fmtTime(seconds)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!running ? (
          <Button variant="primary" onClick={start}>
            <Play size={16} /> {seconds > 0 ? '继续' : '开始'}
          </Button>
        ) : (
          <Button variant="soft" onClick={pause}>
            <Pause size={16} /> 暂停
          </Button>
        )}
        <Button variant="ghost" onClick={reset}>
          <RotateCcw size={16} /> 重置
        </Button>
        <Button variant="outline" onClick={use} disabled={seconds <= 0}>
          <Check size={16} /> {useLabel}
        </Button>
      </div>
    </div>
  )
}
