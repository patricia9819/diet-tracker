import { useCap, type SampleFn } from './platform'

// 用使用者自己的 Claude 帳號（Claude 頁面的 sample 功能），不需要 API 金鑰。
let samplePromise: Promise<SampleFn | null> | null = null
export const getSample = () => (samplePromise ??= useCap<SampleFn>('sample'))

export class NoAiError extends Error {}

export function friendlyError(e: unknown): string {
  if (e instanceof NoAiError) return 'AI 功能只能在 Claude App 或 claude.ai 打開這個頁面時使用。'
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'not_granted': return '你沒有允許這個頁面使用 Claude。重新整理頁面後，在跳出的視窗按「允許」即可。'
    case 'sampling_disabled': return '這個帳號目前無法使用 Claude。'
    case 'rate_limited': return (e as { reason?: string }).reason === 'usage_limit' ? '已達到 Claude 的使用額度，請晚一點再試。' : '使用太頻繁了，請稍等一下再試。'
    case 'session_expired': return '登入已過期，請重新登入 Claude。'
    case 'image_rejected': return '這張照片無法使用，請換一張（JPG、PNG）。'
    case 'images_unavailable': return '這個畫面無法傳送照片給 Claude，請用 Claude App 或瀏覽器打開。'
    case 'refused': return 'Claude 無法處理這個內容，請換一張照片或改用手動輸入。'
    case 'invalid_json': return 'AI 回覆的格式不完整，請再試一次。'
    case 'cancelled': return '已取消。'
    case 'upstream_error': return '連線中斷了，請再試一次。'
  }
  return e instanceof Error ? e.message : '發生錯誤，請再試一次。'
}

async function need(): Promise<SampleFn> {
  const s = await getSample()
  if (!s) throw new NoAiError()
  return s
}

export async function canUseImages() {
  const s = await getSample()
  if (!s) return false
  const l = await s.limits().catch(() => null)
  return !!l?.images
}

export interface MealItem { name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number; concern: string; shared: boolean }
export interface MealResult { items: MealItem[]; comment: string }
export interface LabelResult { name: string; unit: string; kcal: number; protein: number; carbs: number; fat: number; servingsPerPackage: number; vegLabel: string; concern: string; barcode: string }

const n = (v: unknown) => { const x = Number(v); return isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0 }
const s = (v: unknown) => (typeof v === 'string' ? v : '')

/** people > 1 為聚餐模式：回傳每道菜「整道」的數值，並標示是否為大家分食的合菜 */
export async function recognizeMeal(photo: Blob, dietInfo: string, hint: string, people = 1): Promise<MealResult> {
  const group = people > 1
  const prompt = [
    group
      ? `你是台灣的營養師助理。附上的照片是 ${people} 個人聚餐的整桌菜，請辨識每一道菜。`
      : '你是台灣的營養師助理。附上的照片是使用者的一餐，請辨識照片裡每一樣食物，估算份量與營養素。',
    group
      ? [
          '每道菜請估算「整道菜」（整盤、整鍋）的份量與營養素，不要先除以人數，使用者會自己選吃了多少。',
          'shared：大家一起分食的合菜填 true；每人各一份的個人餐點（例如每人一碗白飯、個人飲料、個人套餐）填 false，這類請給「一人份」的數值。',
          '餐廳合菜通常用油較多，請依台灣餐廳的常見做法估算，不要低估油脂。'
        ].join('\n')
      : '以台灣常見的食物與份量為準。同一道菜不要拆得太細，例如一個便當可拆成主食、主菜、配菜。shared 一律填 false。',
    '',
    '使用者的飲食習慣：',
    dietInfo,
    hint ? `\n使用者補充：${hint}` : '',
    '',
    '只回覆一個 JSON 物件，格式如下（數值為數字，熱量單位大卡，其他單位公克）：',
    group
      ? '{"items":[{"name":"麻婆豆腐","portion":"1 盤約 500g","kcal":620,"protein":30,"carbs":20,"fat":46,"shared":true,"concern":""}],"comment":"一兩句整體說明"}'
      : '{"items":[{"name":"五穀飯","portion":"1 碗約 180g","kcal":250,"protein":6,"carbs":52,"fat":2,"shared":false,"concern":""}],"comment":"一兩句整體說明"}',
    'concern：若這道菜可能不符合使用者的飲食習慣（含葷、含五辛、含不吃的蛋或奶、可能用葷高湯），用一句話說明原因；沒有問題就填空字串。',
    '如果照片裡沒有食物，items 為空陣列並在 comment 說明。'
  ].join('\n')
  const r = await (await need()).json<{ items?: unknown[]; comment?: unknown }>(prompt, { images: photo })
  const items = (Array.isArray(r?.items) ? r.items : []).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>
    return {
      name: s(o.name) || '食物', portion: s(o.portion) || '1 份', kcal: n(o.kcal), protein: n(o.protein), carbs: n(o.carbs), fat: n(o.fat),
      concern: s(o.concern), shared: group && o.shared !== false
    }
  })
  return { items, comment: s(r?.comment) }
}

export async function readNutritionLabel(photo: Blob, dietInfo: string): Promise<LabelResult> {
  const prompt = [
    '你是台灣的營養師助理。附上的照片是包裝食品的營養標示或成分表（也可能拍到條碼）。',
    '台灣的營養標示通常有「每份」和「每100公克／毫升」兩欄，請優先讀「每份」；若只有每100公克，unit 填「100 公克」並用該欄數值。',
    '若照片裡有成分表，依使用者的飲食習慣檢查是否有不適合的成分。',
    '',
    '使用者的飲食習慣：',
    dietInfo,
    '',
    '只回覆一個 JSON 物件，格式如下：',
    '{"name":"產品名稱","unit":"1 份 (30 公克)","kcal":135,"protein":2.4,"carbs":18,"fat":6,"servingsPerPackage":8,"vegLabel":"包裝上的素食標示，沒有就空字串","concern":"不適合的成分與原因，沒有就空字串","barcode":"照片裡看得到的條碼數字，沒有就空字串"}'
  ].join('\n')
  const o = (await (await need()).json<Record<string, unknown>>(prompt, { images: photo })) ?? {}
  return {
    name: s(o.name) || '包裝食品', unit: s(o.unit) || '1 份', kcal: n(o.kcal), protein: n(o.protein), carbs: n(o.carbs), fat: n(o.fat),
    servingsPerPackage: n(o.servingsPerPackage) || 1, vegLabel: s(o.vegLabel), concern: s(o.concern), barcode: s(o.barcode).replace(/\D/g, '')
  }
}

export interface StepRead { date: string; steps: number; km: number }

/** 讀健康 App / Garmin Connect 的步數截圖 */
export async function readSteps(photo: Blob, today: string): Promise<{ days: StepRead[]; source: string; note: string }> {
  const d = new Date(today + 'T12:00:00')
  const week = '日一二三四五六'[d.getDay()]
  const prompt = [
    '附上的圖片是手機健康 App（例如 iPhone「健康」、Garmin Connect、Google Fit、小米運動）的步數截圖。',
    `今天是 ${today}（星期${week}）。請讀出圖片裡每一天的步數，並換算成日期（YYYY-MM-DD）。`,
    '「今天」「昨天」「週三」或只有月日的標示，請依今天的日期推算；年份不明時用最接近今天、且不晚於今天的日期。',
    '如果是一週或一個月的長條圖，只列出圖上有明確數字、或能清楚讀出數值的日子，不要猜。看不出日期的數字不要列。',
    '',
    '只回覆一個 JSON 物件：',
    '{"days":[{"date":"2026-11-27","steps":8532,"km":6.1}],"source":"iPhone 健康","note":"一句說明，例如讀不清楚的地方"}',
    'km 是距離（公里），圖上沒有就填 0。如果圖片不是步數紀錄，days 為空陣列並在 note 說明。'
  ].join('\n')
  const r = (await (await need()).json<Record<string, unknown>>(prompt, { images: photo })) ?? {}
  const days = (Array.isArray(r.days) ? r.days : [])
    .map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { date: s(o.date), steps: Math.round(n(o.steps)), km: n(o.km) } })
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= today && x.steps > 0)
  return { days, source: s(r.source), note: s(r.note) }
}

export interface AdviceResult { title: string; summary: string; tips: { icon: string; text: string }[]; detail: string }
const TIP_ICONS = ['bowl', 'egg', 'bean', 'leaf', 'wheat', 'drop', 'walk', 'moon', 'clock', 'target']

export async function getAdvice(dietInfo: string, report: string): Promise<AdviceResult> {
  const prompt = [
    '你是一位溫和、務實的台灣營養師，正在協助使用者減重。請根據下面使用者最近的飲食、體重與活動紀錄給建議。',
    '',
    '使用者的飲食習慣：',
    dietInfo,
    '',
    '規則：',
    '- 使用繁體中文，口吻友善，不說教。',
    '- 建議要具體、可以馬上做到，盡量舉出台灣容易買到、符合使用者飲食習慣的食物（不要建議肉類、海鮮，或使用者不吃的五辛）。',
    '- 使用者是素食者時，留意蛋白質、維生素 B12、鐵、鈣、鋅與 omega-3 是否可能不足，但只在紀錄顯示有需要時提出。',
    '- 不要建議低於安全下限的熱量，也不要做醫療診斷；若數據異常（例如每週減超過 1 公斤），建議諮詢醫師或營養師。',
    '',
    '只回覆一個 JSON 物件：',
    '{"title":"今天最重要的一個重點，12 字以內，可用逗號分兩行，例如「補足蛋白質，讓能量更穩定」",',
    ' "summary":"60 到 100 字，說明為什麼與怎麼做",',
    ' "tips":[{"icon":"egg","text":"20 字以內的具體行動"}],',
    ' "detail":"完整建議，用「## 」做小標題、「- 」做條列，約 250 到 400 字，先肯定做得好的地方"}',
    `tips 給 3 到 4 個；icon 只能是 ${TIP_ICONS.join('、')} 其中之一（bowl 一般飲食、egg 蛋白質、bean 豆製品、leaf 蔬菜、wheat 全穀、drop 喝水、walk 走路活動、moon 睡眠、clock 用餐時間、target 目標）。`,
    '',
    '---',
    report
  ].join('\n')
  const o = (await (await need()).json<Record<string, unknown>>(prompt, { cache: false })) ?? {}
  const tips = (Array.isArray(o.tips) ? o.tips : []).slice(0, 4).map((x) => {
    const t = (x ?? {}) as Record<string, unknown>
    return { icon: TIP_ICONS.includes(s(t.icon)) ? s(t.icon) : 'leaf', text: s(t.text) }
  }).filter((t) => t.text)
  return { title: s(o.title) || '今天的飲食建議', summary: s(o.summary), tips, detail: s(o.detail) }
}
