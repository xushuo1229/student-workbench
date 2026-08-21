import { useState, useRef } from 'react'
import { Settings, Upload, Image, RotateCcw, Palette, Type, Check, Download, HardDriveUpload, Users, Smartphone } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Modal, Button } from './ui/Modal'

/* Convert a local image file into a data URL for background use.
   HD quality: 1920px max long edge, JPEG 0.85 quality.
   Uses URL.createObjectURL (instant) + canvas.toBlob (async, non-blocking).
   Typical output: 200-500KB for phone photos — looks sharp on any screen. */
function fileToBgDataUrl(file, maxSize = 1920) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('未选择文件'))
    if (!file.type || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件'))

    // Step 1: Create object URL — instant (no file reading needed yet)
    const objectUrl = URL.createObjectURL(file)

    const img = new window.Image()
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('图片解析失败')) }
    img.onload = () => {
      // Step 2: Downscale only if needed — 1920px long edge for crisp backgrounds
      const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize))
      const w = Math.max(1, Math.round((img.width || maxSize) * scale))
      const h = Math.max(1, Math.round((img.height || maxSize) * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // High-quality downscaling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
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
        0.85, // High quality for crisp, non-blurry backgrounds
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

/* 云同步状态文案 */
const syncLabel = {
  idle: '尚未同步',
  syncing: '同步中…',
  synced: '☁️ 已同步到云端',
  offline: '⚠️ 云端不可用，本地保存，自动重试',
  local: '📱 本地模式',
}

export function SettingsModal() {
  const { data, updateSettings, settingsOpen, closeSettings, clearAllData, exportAllData, importAllData, pushToast, syncState } = useStore()
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [bgPreview, setBgPreview] = useState(data.settings?.backgroundImage || null)
  const [importing, setImporting] = useState(false)

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

  /* ---- Export all data ---- */
  function handleExport() {
    try {
      const exportData = exportAllData()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `工作台备份_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      pushToast('已导出当前账号数据 ✅')
    } catch (e) {
      pushToast('导出失败，请重试')
    }
  }

  /* ---- Import data from file ---- */
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const jsonObj = JSON.parse(text)
      const mode = confirm('选择导入方式：\n\n「确定」= 合并导入（保留现有数据）\n「取消」= 覆盖导入（替换所有数据）')
        ? 'merge'
        : 'overwrite'
      const count = importAllData(jsonObj, mode)
      pushToast(`成功导入 ${count} 个账号的数据！页面将刷新…`)
      // Reload page to apply imported data
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      alert('导入失败：' + (err.message || '文件格式错误'))
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
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

          {/* Cross-device sync */}
          <div className="mb-4 rounded-xl bg-blue-50/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Smartphone size={16} />
                <span className="text-xs font-semibold">跨设备同步</span>
              </div>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-blue-700">
                {syncLabel[syncState] || syncLabel.idle}
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              使用同一账号登录即可跨设备同步。网络不可用时数据保留在本地，联网后自动恢复同步。
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Export */}
              <Button
                variant="soft"
                size="sm"
                onClick={handleExport}
                className="flex-1"
              >
                <Download size={14} />
                导出数据
              </Button>
              {/* Import */}
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                  className="flex-1"
                >
                  <HardDriveUpload size={14} />
                  {importing ? '导入中…' : '导入数据'}
                </Button>
              </>
            </div>
          </div>

          {/* Danger zone: reset */}
          <div className="rounded-xl bg-rose-50/60 p-4">
            <p className="mb-3 text-xs text-slate-500">
              以下操作会清空当前用户的数据，请谨慎操作。
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm('确定清空当前账号的全部计划、课程、阅读、英语、运动和成长记录吗？\n（个人资料与外观设置会保留，此操作不可撤销）')) {
                    clearAllData()
                  }
                }}
              >
                清空我的数据
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
