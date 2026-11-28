import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]]
])

/** 縮小照片（手機原圖太大會讀很慢），回傳 blob URL */
async function shrink(file: Blob, maxSide: number): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  return URL.createObjectURL(blob ?? file)
}

/** 從照片讀出條碼數字；讀不到回傳空字串 */
export async function decodeBarcode(file: Blob): Promise<string> {
  const reader = new BrowserMultiFormatReader(hints)
  for (const side of [1600, 1000]) {
    let url = ''
    try {
      url = await shrink(file, side)
      const r = await reader.decodeFromImageUrl(url)
      return r.getText().replace(/\D/g, '')
    } catch {
      // 換個尺寸再試一次
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  }
  return ''
}
