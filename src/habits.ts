import type { AppData } from './types'
import { addDays, sortedWeights, sumLogs, targets, todayISO } from './util'

/** 連續記錄飲食的天數（今天還沒記也不算中斷） */
export function streak(d: AppData) {
  const days = new Set(d.logs.map((l) => l.date))
  let day = todayISO()
  if (!days.has(day)) day = addDays(day, -1)
  let n = 0
  while (days.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

function longestStreak(d: AppData) {
  const days = [...new Set(d.logs.map((l) => l.date))].sort()
  let best = 0, cur = 0, prev = ''
  for (const x of days) {
    cur = prev && addDays(prev, 1) === x ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = x
  }
  return best
}

export interface Badge {
  icon: string
  name: string
  desc: string
  got: boolean
  progress?: string
}

export function badges(d: AppData): Badge[] {
  const p = d.profile!
  const ws = sortedWeights(d.weights)
  const first = ws[0]?.kg
  const last = ws[ws.length - 1]?.kg
  const lost = first && last ? first - last : 0
  const best = longestStreak(d)
  const days = [...new Set(d.logs.map((l) => l.date))]
  let proteinDays = 0, budgetDays = 0
  for (const day of days) {
    const tot = sumLogs(d.logs.filter((l) => l.date === day))
    const w = ws.filter((x) => x.date <= day).pop()?.kg ?? last ?? p.goalWeight
    const t = targets(p, w)
    const ex = d.exercises.filter((e) => e.date === day).reduce((a, e) => a + e.kcal, 0) * (p.exerciseAddBack ?? 0.5)
    if (tot.protein >= t.protein * 0.9) proteinDays++
    if (tot.kcal >= (t.kcal + ex) * 0.8 && tot.kcal <= t.kcal + ex) budgetDays++
  }
  const waterDays = Object.values(d.water).filter((ml) => ml >= 2000).length
  const exCount = d.exercises.length
  const prog = (cur: number, goal: number, unit = '') => `${Math.min(Math.floor(cur * 10) / 10, goal)}/${goal}${unit}`

  return [
    { icon: '🌱', name: '第一步', desc: '第一次記錄飲食', got: d.logs.length > 0 },
    { icon: '🔥', name: '三天不間斷', desc: '連續記錄 3 天', got: best >= 3, progress: prog(best, 3, '天') },
    { icon: '📅', name: '一週達人', desc: '連續記錄 7 天', got: best >= 7, progress: prog(best, 7, '天') },
    { icon: '💪', name: '兩週堅持', desc: '連續記錄 14 天', got: best >= 14, progress: prog(best, 14, '天') },
    { icon: '🏅', name: '習慣養成', desc: '連續記錄 30 天', got: best >= 30, progress: prog(best, 30, '天') },
    { icon: '👑', name: '百日傳奇', desc: '連續記錄 100 天', got: best >= 100, progress: prog(best, 100, '天') },
    { icon: '⚖️', name: '面對數字', desc: '記錄體重 7 次', got: ws.length >= 7, progress: prog(ws.length, 7, '次') },
    { icon: '📉', name: '減掉 1 公斤', desc: '比第一筆體重少 1 kg', got: lost >= 1, progress: prog(Math.max(0, lost), 1, 'kg') },
    { icon: '🎯', name: '減掉 3 公斤', desc: '比第一筆體重少 3 kg', got: lost >= 3, progress: prog(Math.max(0, lost), 3, 'kg') },
    { icon: '✨', name: '減掉 5%', desc: '減去起始體重的 5%', got: !!first && lost >= first * 0.05, progress: first ? prog(Math.max(0, lost), Math.round(first * 0.05 * 10) / 10, 'kg') : undefined },
    { icon: '🏆', name: '達成目標', desc: '體重達到目標', got: !!last && last <= p.goalWeight },
    { icon: '🥚', name: '蛋白質達標', desc: '5 天蛋白質達到目標', got: proteinDays >= 5, progress: prog(proteinDays, 5, '天') },
    { icon: '🥗', name: '控制得宜', desc: '7 天熱量剛好在目標內', got: budgetDays >= 7, progress: prog(budgetDays, 7, '天') },
    { icon: '💧', name: '水分充足', desc: '7 天喝水滿 2000 ml', got: waterDays >= 7, progress: prog(waterDays, 7, '天') },
    { icon: '🏃', name: '動起來', desc: '第一次記錄運動', got: exCount >= 1 },
    { icon: '🚴', name: '運動常客', desc: '記錄運動 10 次', got: exCount >= 10, progress: prog(exCount, 10, '次') }
  ]
}
