export type Sex = 'female' | 'male'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  sex: Sex
  birthYear: number
  heightCm: number
  activity: number // TDEE 活動係數
  goalWeight: number
  weeklyLossKg: number
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
}

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '點心' }
]
