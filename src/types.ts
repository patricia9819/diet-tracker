export type Sex = 'female' | 'male'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type DietType = 'omnivore' | 'lacto-ovo' | 'lacto' | 'ovo' | 'vegan'

export const DIETS: { key: DietType; label: string; desc: string }[] = [
  { key: 'lacto-ovo', label: '奶蛋素（蛋奶素）', desc: '不吃肉、魚、海鮮等動物；可吃蛋和奶製品' },
  { key: 'lacto', label: '奶素', desc: '不吃肉類、海鮮和蛋；可吃奶製品' },
  { key: 'ovo', label: '蛋素', desc: '不吃肉類、海鮮和奶；可吃蛋' },
  { key: 'vegan', label: '全素／純素', desc: '不吃任何動物性食物，包含蛋、奶' },
  { key: 'omnivore', label: '葷食', desc: '沒有飲食限制' }
]

export interface Profile {
  sex: Sex
  birthYear: number
  heightCm: number
  activity: number // TDEE 活動係數
  goalWeight: number
  weeklyLossKg: number
  diet?: DietType
  fiveSpices?: boolean // 是否吃五辛（蔥、蒜、韭、薤／蕎、興渠）
  exerciseAddBack?: number // 運動消耗加回額度的比例 0–1
  nickname?: string
  stepGoal?: number
  waterGoal?: number
  reminders?: { weight: boolean; meals: boolean; water: boolean }
}

export interface WeightEntry {
  date: string // YYYY-MM-DD
  kg: number
  bodyFat?: number
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodItem extends Nutrients {
  id: string
  name: string
  unit: string // 一份的描述，例如「1 個 (約 250g)」
  custom?: boolean
  meat?: boolean // 含肉類／海鮮（素食模式會隱藏）
  five?: boolean // 常含五辛
  barcode?: string
}

export interface ExerciseEntry {
  id: string
  date: string
  name: string
  minutes: number
  kcal: number
}

export interface StepDay {
  steps: number
  km?: number
  source: 'screenshot' | 'manual'
}

export interface AdviceTip {
  icon: string
  text: string
}

export interface Advice {
  date: string
  text: string // 完整建議（Markdown）
  title?: string
  summary?: string
  tips?: AdviceTip[]
}

export interface LogEntry extends Nutrients {
  id: string
  date: string
  meal: Meal
  foodId?: string
  name: string
  unit: string
  servings: number // 下面的營養素是「每份」的數值
}

export interface AppData {
  version: 1
  profile: Profile | null
  weights: WeightEntry[]
  logs: LogEntry[]
  customFoods: FoodItem[]
  water: Record<string, number> // date -> ml
  exercises: ExerciseEntry[]
  advice: Advice[]
  steps: Record<string, StepDay> // date -> 步數
  photos: Record<string, Partial<Record<Meal, string>>> // date -> 餐點縮圖（data URL）
}

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '點心' }
]
