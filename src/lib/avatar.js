/* Convert a user-picked local image file into a small, localStorage-safe
   data URL. We downscale to maxSize px and re-encode as JPEG so the stored
   avatar stays ~5-20KB even for large phone photos. */
export function fileToAvatarDataUrl(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('未选择文件'))
    if (!file.type || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取失败'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width || maxSize, img.height || maxSize))
        const w = Math.max(1, Math.round((img.width || maxSize) * scale))
        const h = Math.max(1, Math.round((img.height || maxSize) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        } catch (e) {
          reject(new Error('编码失败'))
        }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/* True when the avatar value is an image (uploaded or remote URL) rather than an emoji. */
export function isImageAvatar(value) {
  return typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))
}
