import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { getApiKey } from './store'

export const AI_MODEL = 'claude-opus-5-5'

export class NoKeyError extends Error {}

function client() {
  const apiKey = getApiKey()
  if (!apiKey) throw new NoKeyError('尚未設定 API 金鑰')
  // 個人自用：金鑰只存在自己的手機上，直接從瀏覽器呼叫 API
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const COMMON = {
  model: AI_MODEL,
  max_tokens: 16000,
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const
}

export function friendlyError(e: unknown): string {
  if (e instanceof NoKeyError) return '請先到「我的」→「AI 設定」輸入 Claude API 金鑰。'
  if (e instanceof Anthropic.AuthenticationError) return 'API 金鑰不正確，請到「我的」重新輸入。'
  if (e instanceof Anthropic.PermissionDeniedError) return '這個 API 金鑰沒有使用權限，請確認帳號狀態。'
  if (e instanceof Anthropic.RateLimitError) return '請求太頻繁或額度不足，請稍後再試，或確認帳戶餘額。'
  if (e instanceof Anthropic.APIConnectionError) return '連不上網路，請確認手機有連線後再試。'
  if (e instanceof Anthropic.APIError) return `AI 服務發生錯誤（${e.status ?? ''}），請稍後再試。`
  return e instanceof Error ? e.message : '發生未知錯誤'
}

/** 把照片縮小並轉成 JPEG base64，降低傳輸量與費用 */
export async function fileToJpegBase64(file: File, maxSide = 1280): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

const MealSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('食物名稱（繁體中文）'),
      portion: z.string().describe('估計份量，例如「1 碗約 200g」'),
      kcal: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      concern: z.string().describe('若可能不符合使用者飲食習慣（含葷、含五辛、含蛋或奶等）就說明原因，否則為空字串')
    })
  ),
  comment: z.string().describe('一兩句整體說明，例如估算的不確定處')
})
export type MealResult = z.infer<typeof MealSchema>

const LabelSchema = z.object({
  name: z.string().describe('產品名稱，看不出來就依內容取一個簡短名稱'),
  unit: z.string().describe('每份的份量描述，例如「1 份 (30 公克)」'),
  kcal: z.number().describe('每份熱量'),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  servingsPerPackage: z.number().describe('本包裝含幾份，看不出來填 1'),
  vegLabel: z.string().describe('包裝上的素食標示，例如「奶蛋素」，沒有就填空字串'),
  concern: z.string().describe('依成分判斷是否不符合使用者飲食習慣，說明原因；沒有問題就填空字串')
})
export type LabelResult = z.infer<typeof LabelSchema>

async function parseImage<T extends z.ZodType>(schema: T, system: string, b64: string, text: string): Promise<z.infer<T>> {
  const res = await client().beta.messages.parse({
    ...COMMON,
    output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
    system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text }
        ]
      }
    ]
  })
  if (res.stop_reason === 'refusal') throw new Error('AI 無法處理這張照片，請換一張再試。')
  if (!res.parsed_output) throw new Error('AI 回覆格式不完整，請再試一次。')
  return res.parsed_output as z.infer<T>
}

export function recognizeMeal(b64: string, dietInfo: string, hint: string) {
  const system = [
    '你是台灣的營養師助理。使用者拍了一餐的照片，請辨識照片裡每一樣食物並估算份量與營養素（熱量 kcal、蛋白質、碳水化合物、脂肪，單位公克）。',
    '以台灣常見的食物與份量為準，數值取整數或一位小數。同一道菜不要拆得太細，例如一個便當可拆成主食、主菜、配菜。',
    '如果照片裡沒有食物，items 回傳空陣列並在 comment 說明。',
    '',
    '使用者的飲食習慣：',
    dietInfo
  ].join('\n')
  return parseImage(MealSchema, system, b64, hint ? `補充說明：${hint}` : '請辨識這餐。')
}

export function readNutritionLabel(b64: string, dietInfo: string) {
  const system = [
    '你是台灣的營養師助理。使用者拍了包裝食品的營養標示或成分表，請讀出「每份」的熱量與蛋白質、碳水化合物、脂肪（公克）。',
    '台灣的營養標示通常有「每份」和「每100公克／毫升」兩欄，請優先使用「每份」。若只有每100公克，unit 寫「100 公克」並用該欄數值。',
    '若照片裡有成分表，依使用者的飲食習慣檢查是否有不適合的成分。',
    '',
    '使用者的飲食習慣：',
    dietInfo
  ].join('\n')
  return parseImage(LabelSchema, system, b64, '請讀出這個營養標示。')
}

export async function getAdvice(dietInfo: string, report: string) {
  const res = await client().beta.messages.create({
    ...COMMON,
    output_config: { effort: 'medium' },
    system: [
      '你是一位溫和、務實的台灣營養師，正在協助使用者減重。請根據使用者最近的飲食、體重與運動紀錄給建議。',
      '使用者的飲食習慣：',
      dietInfo,
      '',
      '回覆規則：',
      '- 使用繁體中文，口吻友善，不說教。',
      '- 先用一兩句肯定做得好的地方，再給 3 到 5 個具體、可以馬上做到的調整建議，盡量舉出台灣容易買到、符合使用者飲食習慣的食物。',
      '- 若是素食者，特別留意蛋白質、維生素 B12、鐵、鈣、鋅與 omega-3 是否可能攝取不足，但只在紀錄顯示有需要時提出。',
      '- 不要建議低於安全下限的熱量，也不要做醫療診斷；若數據顯示異常（例如每週減超過 1 公斤），建議諮詢醫師或營養師。',
      '- 格式：用「## 」做小標題、「- 」做條列，全文約 300 到 500 字。'
    ].join('\n'),
    messages: [{ role: 'user', content: report }]
  })
  if (res.stop_reason === 'refusal') throw new Error('AI 這次無法產生建議，請稍後再試。')
  return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
}
