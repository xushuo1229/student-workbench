import { useState, useRef } from 'react'
import { Settings, Upload, Image, RotateCcw, Palette, Type, Check } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Modal, Button } from './ui/Modal'

/* Convert a local image file into a data URL for background use.
   Ultra-fast: uses URL.createObjectURL (instant) + canvas.toBlob (async/non-blocking)
   + small output size (960px max, JPEG 0.5). Phone photos process in ~100-200ms. */
function fileToBgDataUrl(file, maxSize = 960) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('未选择文件'))
    if (!file.type || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件'))

    // Step 1: Create object URL — instant (no file reading needed yet)
    const objectUrl = URL.createObjectURL(file)

    const img = new window.Image()
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('图片解析失败')) }
    img.onload = () => {
      // Step 2: Downscale aggressively — 960px long edge is plenty for a bg
      const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize))
      const w = Math.max(1, Math.round((img.width || maxSize) * scale))
      const h = Math.max(1, Math.round((img.height || maxSize) * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      // Done with image & object URL
      URL.revokeObjectURL(objectUrl)

      // Step 3: toBlob is ASYNC — does NOT block the UI thread!
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('编码失败')); return }
          // Convert blob → dataURL for localStorage storage
          const reader = new FileReader()
          reader.onerror = () => reject(new Error('读取编码结果失败'))
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.5, // Low quality OK for backgrounds; makes encoding much faster
      )
    }
    img.src = objectUrl
  })
}

const PRESET_BACKGROUNDS = [
  {
    id: 'default',
    name: '默认渐变',
    preview: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 50%, #fef3c7 100%)',
    value: null,
  },
  {
    id: 'sunset',
    name: '日落暖阳',
    preview: 'linear-gradient(135deg, #fecaca 0%, #fdba74 40%, #fde68a 100%)',
    value: 'linear-gradient(135deg, #fecaca 0%, #fdba74 40%, #fde68a 100%)',
  },
  {
    id: 'ocean',
    name: '海洋清新',
    preview: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 40%, #bae6fd 100%)',
    value: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 40%, #bae6fd 100%)',
  },
  {
    id: 'forest',
    name: '森林静谧',
    preview: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 40%, #d9f99d 100%)',
    value: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 40%, #d9f99d 100%)',
  },
  {
    id: 'lavender',
    name: '薰衣草田',
    preview: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 40%, #c4b5fd 100%)',
    value: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 40%, #c4b5fd 100%)',
  },
  {
    id: 'cherry',
    name: '樱花粉',
    preview: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 40%, #f9a8d4 100%)',
    value: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 40%, #f9a8d4 100%)',
  },
  {
    id: 'midnight',
    name: '深夜星空',
    preview: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    dark: true,
  },
]

export function SettingsModal() {
  const { data, updateSettings, settingsOpen, closeSettings, resetAll } = useStore()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('') // 'reading' | 'processing' | 'saving'
  const [bgPreview, setBgPreview] = useState(data.settings?.backgroundImage || null)

  const currentBg = data.settings?.backgroundImage || null

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadStep('processing')
    try {
      // fileToBgDataUrl now uses URL.createObjectURL (instant) + toBlob (async, non-blocking)
      const dataUrl = await fileToBgDataUrl(file)

      setUploadStep('saving')
      setBgPreview(dataUrl)
      updateSettings({ backgroundImage: dataUrl })
    } catch (err) {
      alert(err.message || '图片处理失败')
    } finally {
      setUploading(false)
      setUploadStep('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /* Upload step labels */
  const uploadLabels = {
    processing: '🖼️ 压缩图片中…',
    saving: '💾 保存设置中…',
  }

  function getUploadText() {
    return uploadStep ? uploadLabels[uploadStep] : '上传本地图片作为背景'
  }

  function handlePresetSelect(preset) {
    setBgPreview(preset.value)
    updateSettings({ backgroundImage: preset.value, isDarkTheme: preset.dark || false })
  }

  function handleResetBg() {
    setBgPreview(null)
    updateSettings({ backgroundImage: null, isDarkTheme: false })
  }

  function handleRemoveCustomBg() {
    setBgPreview(null)
    updateSettings({ backgroundImage: null })
  }

  /* Determine active preset ID */
  const activePresetId = PRESET_BACKGROUNDS.find((p) => p.value === currentBg)?.id || null
  const isCustomImage = currentBg && currentBg.startsWith('data:') && !activePresetId

  return (
    <Modal
      open={settingsOpen}
      onClose={closeSettings}
      title="设置"
      subtitle="个性化你的工作台"
      size="lg"
    >
      <div className="space-y-6">
        {/* ===== Background Image Section ===== */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Image size={17} className="text-brand-500" />
            界面背景
          </h3>

          {/* Current background preview */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200">
            <div
              className="flex h-32 w-full items-center justify-center bg-slate-100 text-sm text-slate-400"
              style={
                bgPreview?.startsWith('data:')
                  ? { backgroundImage: `url(${bgPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : bgPreview
                    ? { backgroundImage: bgPreview, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : undefined
              }
            >
              {!bgPreview && <span>当前：默认渐变背景</span>}
              {bgPreview && (
                <div className="rounded-xl bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
                  当前背景预览
                </div>
              )}
            </div>
          </div>

          {/* Upload custom image */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Upload size={16} />
              {getUploadText()}
            </Button>
            <p className="mt-1.5 text-[11px] text-slate-400">支持 JPG、PNG、WebP，自动压缩优化</p>
          </div>

          {/* Preset gradients */}
          <div className="mb-3">
            <p className="mb-2 text-xs font-medium text-slate-500">预设渐变背景</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {PRESET_BACKGROUNDS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  title={preset.name}
                  className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all hover:scale-105 ${
                    activePresetId === preset.id
                      ? 'border-brand-500 shadow-md shadow-brand-200 ring-2 ring-brand-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="h-full w-full"
                    style={{ backgroundImage: preset.preview, backgroundSize: 'cover' }}
                  />
                  {activePresetId === preset.id && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-1 py-0.5 text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reset / Remove actions */}
          {(currentBg) && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetBg}>
                <RotateCcw size={14} />
                恢复默认
              </Button>
              {isCustomImage && (
                <Button variant="ghost" size="sm" onClick={handleRemoveCustomBg}>
                  移除自定义背景
                </Button>
              )}
            </div>
          )}
        </section>

        {/* ===== Appearance Section ===== */}
        <section className="border-t border-slate-100 pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Palette size={17} className="text-brand-500" />
            外观设置
          </h3>

          <div className="space-y-3">
            {/* Card transparency */}
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Type size={15} className="text-slate-400" />
                <span className="text-sm text-slate-600">卡片毛玻璃效果</span>
              </div>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-400"
                value={data.settings?.glassIntensity ?? 'normal'}
                onChange={(e) => updateSettings({ glassIntensity: e.target.value })}
              >
                <option value="light">轻柔</option>
                <option value="normal">正常</option>
                <option value="strong">强烈</option>
              </select>
            </label>
          </div>
        </section>

        {/* ===== Data Management Section ===== */}
        <section className="border-t border-slate-100 pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Settings size={17} className="text-brand-500" />
            数据管理
          </h3>
          <div className="rounded-xl bg-rose-50/60 p-4">
            <p className="mb-3 text-xs text-slate-500">
              以下操作会影响你的数据，请谨慎操作。
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm('确定要清除所有数据并恢复到初始状态吗？此操作不可撤销。')) {
                    resetAll()
                  }
                }}
              >
                重置所有数据
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
