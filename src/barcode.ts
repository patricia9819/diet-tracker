import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import type { FoodItem } from './types'
import { uid } from './util'

export async function startScan(video: HTMLVideoElement, onCode: (code: string) => void): Promise<IScannerControls> {
  const reader = new BrowserMultiFormatReader()
  return reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result) => {
    if (result) onCode(result.getText())
  })
}

export interface OffResult {
  food: FoodItem
  concern: string
}

const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : 0)

/** 查詢 Open Food Facts 公開資料庫（台灣產品收錄較少，查不到時改拍營養標示） */
export async function lookupBarcode(code: string): Promise<OffResult | null> {
  const fields = 'product_name,product_name_zh,product_name_zh-tw,brands,nutriments,serving_size,ingredients_analysis_tags'
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`)
  if (!res.ok) return null
  const j = await res.json()
  if (j.status !== 1 || !j.product) return null
  const p = j.product
  const nu = p.nutriments ?? {}
  const perServing = typeof nu['energy-kcal_serving'] === 'number'
  const suffix = perServing ? '_serving' : '_100g'
  const kcal = n(nu['energy-kcal' + suffix])
  if (!kcal && !n(nu['proteins' + suffix])) return null
  const name = p['product_name_zh-tw'] || p.product_name_zh || p.product_name || `條碼 ${code}`
  const tags: string[] = p.ingredients_analysis_tags ?? []
  return {
    food: {
      id: 'c' + uid(),
      name: p.brands ? `${name}（${String(p.brands).split(',')[0]}）` : name,
      unit: perServing ? `1 份${p.serving_size ? ` (${p.serving_size})` : ''}` : '100 公克',
      kcal,
      protein: n(nu['proteins' + suffix]),
      carbs: n(nu['carbohydrates' + suffix]),
      fat: n(nu['fat' + suffix]),
      custom: true,
      barcode: code
    },
    concern: tags.includes('en:non-vegetarian')
      ? '資料庫標示為「非素食」，請看包裝確認。'
      : tags.includes('en:vegetarian-status-unknown') || tags.includes('en:maybe-vegetarian')
        ? '資料庫無法確定是否為素食，請看包裝上的素食標示。'
        : ''
  }
}
