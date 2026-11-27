import { DIETS, type FoodItem, type Profile } from './types'

export const dietOf = (p: Profile) => p.diet ?? 'omnivore'
export const isVeg = (p: Profile) => dietOf(p) !== 'omnivore'
export const avoidsFive = (p: Profile) => isVeg(p) && p.fiveSpices === false

/** 依飲食類型過濾食物庫（自訂食物一律保留） */
export function allowedFood(p: Profile, f: FoodItem) {
  if (f.custom) return true
  if (isVeg(p) && f.meat) return false
  return true
}

/** 給 AI 的飲食習慣說明 */
export function dietPrompt(p: Profile) {
  const d = DIETS.find((x) => x.key === dietOf(p))!
  if (d.key === 'omnivore') return '使用者沒有特別的飲食限制（葷食）。'
  const lines = [
    `使用者吃「${d.label}」：${d.desc}。`,
    p.fiveSpices === false
      ? '使用者不吃五辛（蔥、蒜、韭、薤（蕎頭）、興渠），含五辛的食物也要提醒。'
      : '使用者可以吃五辛（蔥、蒜、韭等），不必提醒。',
    '請留意常見的隱藏葷食成分並提醒：豬油、牛油、動物性明膠（吉利丁）、魚露、柴魚、蝦米、干貝、蠔油、雞粉或大骨高湯、蝦醬、XO 醬、胭脂蟲紅等。',
    '依台灣規定，素食包裝會標示「全素或純素」、「蛋素」、「奶素」、「奶蛋素」或「植物五辛素」。'
  ]
  if (d.key === 'vegan' || d.key === 'ovo') lines.push('使用者不吃奶製品（含乳清、起司、奶油）。')
  if (d.key === 'vegan' || d.key === 'lacto') lines.push('使用者不吃蛋（含蛋黃醬、蛋糕等含蛋製品）。')
  return lines.join('\n')
}
