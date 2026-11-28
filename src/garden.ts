import manifest from '../public/flowers/manifest.json'
import type { AppData } from './types'
import { addDays, todayISO } from './util'

export interface Flower { id: string; name: string; words: string; group: number; sizes: [number, number][]; gsizes?: [number, number][] }
export const FLOWERS = manifest.flowers as Flower[]
export const GROUPS = manifest.groups as string[]
export const STAGES = ['種子', '花苗', '成長 50%', '成長 75%', '成花']
const byId = new Map(FLOWERS.map((f) => [f.id, f]))
export const flowerOf = (id: string | undefined) => (id ? byId.get(id) : undefined)
export const flowerSrc = (id: string, stage: number | 'p' | 'g2' | 'g3' | 'g4') => `flowers/${id}-${stage}.webp`

/** 喝水比例 → 生長階段：0 種子、1 花苗、2 成長 50%、3 成長 75%、4 成花；沒喝水是 -1（空土） */
export const stageOf = (water: number, goal: number) => {
  if (water <= 0) return -1
  const p = goal ? water / goal : 0
  return p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : p < 1 ? 3 : 4
}

/** 沒有抽花紀錄的舊日子，用日期固定對應一種花（只用來顯示） */
function hashFlower(date: string) {
  let h = 0
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return FLOWERS[h % FLOWERS.length].id
}

/** 某天的花：有抽過就用抽到的；有喝水但沒抽過（功能上線前）就用固定對應 */
export function dayFlower(d: AppData, date: string) {
  return d.garden?.[date] ?? ((d.water[date] ?? 0) > 0 ? hashFlower(date) : undefined)
}

/** 已收集（開過花）的花：id → 第一次開花的日期與次數 */
export function collection(d: AppData) {
  const goal = d.profile?.waterGoal ?? 2000
  const out = new Map<string, { first: string; count: number }>()
  for (const date of Object.keys(d.water).sort()) {
    if (stageOf(d.water[date], goal) < 4) continue
    const id = dayFlower(d, date)
    if (!id) continue
    const c = out.get(id)
    out.set(id, c ? { first: c.first, count: c.count + 1 } : { first: date, count: 1 })
  }
  return out
}

/** 抽一種花：優先抽還沒收集的，全部收集後隨機（避開昨天那種） */
export function pickFlower(d: AppData, date: string) {
  const got = collection(d)
  const yesterday = dayFlower(d, addDays(date, -1))
  let pool = FLOWERS.filter((f) => !got.has(f.id) && f.id !== yesterday)
  if (!pool.length) pool = FLOWERS.filter((f) => f.id !== yesterday)
  return pool[Math.floor(Math.random() * pool.length)].id
}

/** 今日任務：三餐、體重、喝水 */
export function dayTasks(d: AppData, date = todayISO()) {
  const goal = d.profile?.waterGoal ?? 2000
  const has = (m: string) => d.logs.some((l) => l.date === date && l.meal === m)
  const tasks = [
    { key: 'breakfast', label: '早餐', done: has('breakfast') },
    { key: 'lunch', label: '午餐', done: has('lunch') },
    { key: 'dinner', label: '晚餐', done: has('dinner') },
    { key: 'weight', label: '體重', done: d.weights.some((w) => w.date === date) },
    { key: 'water', label: '喝水', done: (d.water[date] ?? 0) >= goal }
  ]
  return { tasks, done: tasks.every((t) => t.done) }
}
