// 從螢幕錄影擷取畫面：每隔一段時間抓一張，去掉幾乎一樣的畫面
export async function extractFrames(file: Blob, max: number, onProgress?: (done: number, total: number) => void): Promise<Blob[]> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  try {
    await new Promise<void>((ok, fail) => {
      v.onloadedmetadata = () => ok()
      v.onerror = () => fail(new Error('無法讀取這段影片，請換一段（MP4 或 MOV）。'))
      setTimeout(() => fail(new Error('影片讀取逾時，請換一段較短的錄影。')), 15000)
    })
    // iOS 需要先播放一下才能跳到指定時間
    await v.play().then(() => v.pause()).catch(() => {})
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1
    const count = Math.min(80, Math.max(2, Math.round(dur / 0.4)))
    const scale = Math.min(1, 1400 / Math.max(v.videoWidth || 1, v.videoHeight || 1))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round((v.videoWidth || 720) * scale))
    c.height = Math.max(1, Math.round((v.videoHeight || 1280) * scale))
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    // 用較細的格子比對，才抓得到只有一小塊（例如上方的數字標籤）改變的畫面
    const tiny = document.createElement('canvas')
    tiny.width = 48; tiny.height = Math.max(48, Math.round((48 * c.height) / c.width))
    const tctx = tiny.getContext('2d', { willReadFrequently: true })!
    const frames: { blob: Blob; sig: number[] }[] = []
    for (let i = 0; i < count; i++) {
      const t = Math.min(dur - 0.05, ((i + 0.5) / count) * dur)
      await new Promise<void>((ok) => {
        const done = () => { v.removeEventListener('seeked', done); ok() }
        v.addEventListener('seeked', done)
        v.currentTime = Math.max(0, t)
        setTimeout(done, 3000)
      })
      ctx.drawImage(v, 0, 0, c.width, c.height)
      tctx.drawImage(c, 0, 0, tiny.width, tiny.height)
      const px = tctx.getImageData(0, 0, tiny.width, tiny.height).data
      const sig: number[] = []
      for (let k = 0; k < px.length; k += 4) sig.push((px[k] + px[k + 1] + px[k + 2]) / 3)
      // 跟上一張保留的畫面比，有明顯改變的格子數夠多才保留
      const prev = frames[frames.length - 1]
      const changed = prev ? sig.reduce((a, x, k) => a + (Math.abs(x - prev.sig[k]) > 28 ? 1 : 0), 0) : 999
      if (changed >= 4) {
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82))
        if (blob) frames.push({ blob, sig })
      }
      onProgress?.(i + 1, count)
    }
    // 太多張就平均挑選
    const out = frames.map((f) => f.blob)
    if (out.length <= max) return out
    return Array.from({ length: max }, (_, i) => out[Math.round((i * (out.length - 1)) / (max - 1))])
  } finally {
    v.removeAttribute('src')
    v.load()
    URL.revokeObjectURL(url)
  }
}
