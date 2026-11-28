import { useEffect, useRef, useState } from 'react'
import type { useStore } from './store'
import { Icon } from './icons'
import { fmt } from './ui'
import { todayISO } from './util'
import { toast } from './dialogs'

type Store = ReturnType<typeof useStore>

export const DEFAULT_CUPS = [800, 1100]
const SLOTS = [9, 11, 13, 15, 17, 19, 21] // 每格代表從這個整點起的兩小時

/** 依喝水比例決定盆栽長到哪個階段：0 種子、1 發芽、2 長葉、3 茂盛、4 花苞、5 開花 */
export const stageOf = (pct: number) => (pct <= 0 ? 0 : pct < 0.25 ? 1 : pct < 0.5 ? 2 : pct < 0.75 ? 3 : pct < 1 ? 4 : 5)

/** 此刻「應該」喝到多少（9 點到 21 點平均分配） */
const shouldBy = (goal: number, d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60
  return Math.max(0, Math.min(1, (h - 9) / 12)) * goal
}

function message(water: number, goal: number, isToday: boolean) {
  if (!isToday) return water >= goal ? '這天的花有開。' : water > 0 ? `這天喝了 ${fmt(water)} ml。` : '這天沒有喝水紀錄。'
  const h = new Date().getHours()
  const left = goal - water
  if (water >= goal) return '今天的花開了，明天見！'
  if (left <= 300) return `再 ${fmt(left)} ml 就開花了！`
  if (water === 0) return h < 11 ? '早安，先給小盆栽一杯水吧。' : '今天還沒澆水喔，先喝一杯吧。'
  if (water < shouldBy(goal) - 300) return h >= 14 && h < 18 ? '下午容易忘記，現在喝一杯剛好。' : '小盆栽有點渴了…喝口水吧。'
  if (h >= 20) return `睡前別喝太多，還差 ${fmt(left)} ml。`
  return '進度很穩，繼續保持。'
}

export default function WaterPlant({ store, date }: { store: Store; date: string }) {
  const { data, update } = store
  const p = data.profile!
  const goal = p.waterGoal ?? 2000
  const cups = (p.cups?.length ? p.cups : DEFAULT_CUPS).filter((c) => c > 0)
  const water = data.water[date] ?? 0
  const log = data.waterLog?.[date] ?? []
  const isToday = date === todayISO()
  const pct = goal ? water / goal : 0
  const stage = stageOf(pct)
  const thirsty = (p.reminders?.water ?? true) && isToday && stage < 5 && water < shouldBy(goal) - 300 && new Date().getHours() >= 11

  // 動畫狀態
  const [drops, setDrops] = useState<{ id: number; ml: number }[]>([])
  const [bounce, setBounce] = useState(0)
  const [bloom, setBloom] = useState(0)
  const nid = useRef(0)
  const prevStage = useRef(stage)
  useEffect(() => {
    if (stage === 5 && prevStage.current < 5 && isToday) { setBloom((b) => b + 1); toast('今天的花開了！') }
    prevStage.current = stage
  }, [stage, isToday])

  const add = (ml: number) => {
    const now = new Date()
    const minute = now.getHours() * 60 + now.getMinutes()
    update((d) => ({
      ...d,
      water: { ...d.water, [date]: (d.water[date] ?? 0) + ml },
      waterLog: isToday ? { ...d.waterLog, [date]: [...(d.waterLog?.[date] ?? []), [minute, ml]] } : d.waterLog
    }))
    const id = ++nid.current
    setDrops((x) => [...x, { id, ml }])
    setBounce((b) => b + 1)
  }

  const undo = () => {
    const last = log[log.length - 1]
    const ml = last ? last[1] : Math.min(100, water)
    if (!ml) return
    update((d) => ({
      ...d,
      water: { ...d.water, [date]: Math.max(0, (d.water[date] ?? 0) - ml) },
      waterLog: last ? { ...d.waterLog, [date]: (d.waterLog?.[date] ?? []).slice(0, -1) } : d.waterLog
    }))
    toast(`已復原 −${fmt(ml)} ml`)
  }

  // 時間軸：每兩小時一格
  const nowH = new Date().getHours()
  const slots = SLOTS.map((h) => {
    const ml = log.filter(([m]) => m >= (h === 9 ? 0 : h * 60) && m < (h === 21 ? 24 * 60 : (h + 2) * 60)).reduce((a, [, v]) => a + v, 0)
    return { h, ml, now: isToday && nowH >= h && nowH < h + 2, past: !isToday || nowH >= h + 2 }
  })

  return (
    <section className={'plant-card' + (thirsty ? ' thirsty' : '') + (stage === 5 ? ' bloomed' : '')}>
      <div className="plant-top">
        <div className="plant-stage" aria-hidden="true">
          <Plant stage={stage} thirsty={thirsty} bounceKey={bounce} />
          {drops.map((d) => (
            <span key={d.id} className="drop-wrap" onAnimationEnd={(e) => e.target === e.currentTarget && setDrops((x) => x.filter((y) => y.id !== d.id))}>
              <span className="drop" />
              <span className="ripple" />
              <span className="float-ml">+{fmt(d.ml)}</span>
            </span>
          ))}
          {bloom > 0 && (
            <span className="petals" key={bloom}>
              {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />)}
            </span>
          )}
        </div>
        <div className="plant-info">
          <div className="plant-title"><Icon name="sprout" size={18} />{isToday ? '今天的小盆栽' : '當天的小盆栽'}</div>
          <div className="plant-ml"><b>{fmt(water)}</b><span> / {fmt(goal)} ml</span></div>
          <div className="plant-bar"><span style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
          <p className="plant-msg" aria-live="polite">{message(water, goal, isToday)}</p>
        </div>
      </div>

      {isToday && (
        <div className="timeline" role="img" aria-label={`喝水時間軸：${slots.filter((s) => s.ml).map((s) => `${s.h} 點 ${s.ml} ml`).join('、') || '還沒喝'}`}>
          {slots.map((s) => (
            <div key={s.h} className={'slot' + (s.ml ? ' on' : '') + (s.now ? ' now' : '') + (!s.ml && s.past ? ' miss' : '')}>
              <span className="dot"><Icon name="drop" size={14} /></span>
              <small>{s.h}</small>
            </div>
          ))}
        </div>
      )}

      <div className="water-btns">
        <button className="wb undo" onClick={undo} disabled={water <= 0} aria-label="復原上一次喝水"><Icon name="undo" size={18} /></button>
        <button className="wb" onClick={() => add(100)}><Icon name="drop" size={16} />+100</button>
        {cups.slice(0, 2).map((c, i) => (
          <button className="wb cup" key={i} onClick={() => add(c)}><Icon name={i === 0 ? 'cup' : 'bottle'} size={17} />{fmt(c)}</button>
        ))}
      </div>
    </section>
  )
}

/** 小盆栽插畫：stage 0–5 逐步長大，口渴時葉子垂下 */
function Plant({ stage, thirsty, bounceKey }: { stage: number; thirsty: boolean; bounceKey: number }) {
  const stemH = [0, 18, 32, 44, 52, 56][stage]
  const top = 96 - stemH
  const leaf = (y: number, side: 1 | -1, size: number, show: boolean, k: string) => (
    <path
      key={k}
      className={'leaf' + (show ? ' show' : '')}
      style={{ transformOrigin: `60px ${y}px` }}
      d={side < 0
        ? `M60 ${y} C ${60 - size * 0.4} ${y - size * 0.55}, ${60 - size * 1.1} ${y - size * 0.45}, ${60 - size * 1.25} ${y - size * 0.05} C ${60 - size * 0.9} ${y + size * 0.15}, ${60 - size * 0.35} ${y + size * 0.1}, 60 ${y} Z`
        : `M60 ${y} C ${60 + size * 0.4} ${y - size * 0.55}, ${60 + size * 1.1} ${y - size * 0.45}, ${60 + size * 1.25} ${y - size * 0.05} C ${60 + size * 0.9} ${y + size * 0.15}, ${60 + size * 0.35} ${y + size * 0.1}, 60 ${y} Z`}
    />
  )
  return (
    <svg viewBox="0 0 120 140" className="plant-svg">
      <g key={bounceKey} className={'plant-sway' + (bounceKey ? ' bounce' : '') + (thirsty ? ' droop' : '')}>
        {stage === 0 && <ellipse cx="60" cy="95" rx="5" ry="3.5" className="seed" />}
        {stage > 0 && <path className="stem" d={`M60 97 C 58 ${97 - stemH * 0.4}, 62 ${97 - stemH * 0.7}, 60 ${top}`} />}
        {leaf(top + 2, -1, 11, stage >= 1, 'a')}
        {leaf(top + 2, 1, 11, stage >= 1, 'b')}
        {leaf(84, -1, 15, stage >= 2, 'c')}
        {leaf(76, 1, 16, stage >= 3, 'd')}
        {leaf(66, -1, 14, stage >= 3, 'e')}
        {stage === 4 && <ellipse cx="60" cy={top - 4} rx="4.5" ry="6.5" className="bud" />}
        {stage === 5 && (
          <g className="flower" style={{ transformOrigin: `60px ${top - 6}px` }}>
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={i} cx="60" cy={top - 16} rx="6.5" ry="10" className="petal" transform={`rotate(${i * 60} 60 ${top - 6})`} />
            ))}
            <circle cx="60" cy={top - 6} r="5.5" className="core" />
          </g>
        )}
      </g>
      <ellipse cx="60" cy="98" rx="30" ry="6" className="soil" />
      <path d="M30 98 L36 134 Q37 138 41 138 L79 138 Q83 138 84 134 L90 98 Z" className="pot" />
      <rect x="27" y="94" width="66" height="9" rx="3" className="pot-rim" />
    </svg>
  )
}
