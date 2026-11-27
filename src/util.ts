import type { LogEntry, Nutrients, Profile, WeightEntry } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s: string, n: number) => {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const fmtDate = (s: string) => {
  const d = parseISO(s)
  const w = '日一二三四五六'[d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}（${w}）`
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const r1 = (n: number) => Math.round(n * 10) / 10

export const ACTIVITY_LEVELS = [
  { v: 1.2, label: '久坐（幾乎不運動）' },
  { v: 1.375, label: '輕度（每週運動 1–3 天）' },
  { v: 1.55, label: '中度（每週運動 3–5 天）' },
  { v: 1.725, label: '高度（每週運動 6–7 天）' },
  { v: 1.9, label: '非常高（勞力工作或一天兩練）' }
]

/** Mifflin-St Jeor 基礎代謝率 */
export function bmr(p: Profile, kg: number) {
  const age = new Date().getFullYear() - p.birthYear
  return 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161)
}

export function bmi(p: Profile, kg: number) {
  const m = p.heightCm / 100
  return kg / (m * m)
}

export function bmiLabel(v: number) {
  // 台灣衛福部標準
  if (v < 18.5) return '過輕'
  if (v < 24) return '正常'
  if (v < 27) return '過重'
  return '肥胖'
}

export interface Targets extends Nutrients {
  bmr: number
  tdee: number
  floored: boolean
}

export function targets(p: Profile, kg: number): Targets {
  const b = bmr(p, kg)
  const tdee = b * p.activity
  const floor = p.sex === 'male' ? 1500 : 1200
  const atGoal = kg <= p.goalWeight
  const deficit = atGoal ? 0 : (p.weeklyLossKg * 7700) / 7
  let kcal = tdee - deficit
  let floored = false
  if (kcal < floor) {
    kcal = Math.min(floor, tdee)
    floored = true
  }
  kcal = Math.round(kcal / 10) * 10
  const protein = Math.round(kg * 1.6)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { bmr: Math.round(b), tdee: Math.round(tdee), kcal, protein, carbs, fat, floored }
}

export function sumLogs(logs: LogEntry[]): Nutrients {
  return logs.reduce(
    (a, l) => ({
      kcal: a.kcal + l.kcal * l.servings,
      protein: a.protein + l.protein * l.servings,
      carbs: a.carbs + l.carbs * l.servings,
      fat: a.fat + l.fat * l.servings
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

export const sortedWeights = (w: WeightEntry[]) => [...w].sort((a, b) => a.date.localeCompare(b.date))

/** 7 日移動平均（以日期計，不足 7 筆就用現有的） */
export function withMovingAvg(ws: WeightEntry[]) {
  const s = sortedWeights(ws)
  return s.map((e) => {
    const from = addDays(e.date, -6)
    const win = s.filter((x) => x.date >= from && x.date <= e.date)
    const avg = win.reduce((a, x) => a + x.kg, 0) / win.length
    return { ...e, avg: r1(avg) }
  })
}
