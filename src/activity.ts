import type { AppData } from './types'

/** 走路消耗：約每步 0.0005 × 體重(kg) 大卡（70 kg 約 0.035 大卡／步） */
export const walkKcal = (steps: number, kg: number) => Math.round(steps * kg * 0.0005)

/** 日常基本活動已算在「每日消耗」裡，只有超過這個步數的部分才算額外活動 */
export const STEP_BASELINE = 5000

export function dayActivity(d: AppData, date: string, kg: number) {
  const steps = d.steps?.[date]?.steps ?? 0
  const walk = walkKcal(steps, kg)
  const extraWalk = walkKcal(Math.max(0, steps - STEP_BASELINE), kg)
  const ex = d.exercises.filter((e) => e.date === date).reduce((a, e) => a + e.kcal, 0)
  const ratio = d.profile?.exerciseAddBack ?? 0.5
  return { steps, walk, ex, total: walk + ex, bonus: Math.round((extraWalk + ex) * ratio) }
}
