import { useState } from 'react'
import type { useStore } from './store'
import { MEALS, type Meal } from './types'
import { addDays, fmtDate, r1, sumLogs, targets, todayISO } from './util'
import AddFood from './AddFood'
import { streak } from './habits'

type Store = ReturnType<typeof useStore>

function Bar({ label, value, goal, unit, color }: { label: string; value: number; goal: number; unit: string; color: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = value > goal
  return (
    <div className="bar">
      <div className="bar-head">
        <span>{label}</span>
        <span className={over ? 'over' : ''}>{Math.round(value)} / {goal}{unit}</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: over ? 'var(--bad)' : color }} /></div>
    </div>
  )
}

export default function Today({ store, currentKg }: { store: Store; currentKg: number }) {
  const { data, update } = store
  const [date, setDate] = useState(todayISO())
  const [adding, setAdding] = useState<Meal | null>(null)
  const t = targets(data.profile!, currentKg)
  const dayLogs = data.logs.filter((l) => l.date === date)
  const total = sumLogs(dayLogs)
  const exKcal = data.exercises.filter((e) => e.date === date).reduce((a, e) => a + e.kcal, 0)
  const exBonus = Math.round(exKcal * (data.profile!.exerciseAddBack ?? 0.5))
  const budget = t.kcal + exBonus
  const left = budget - Math.round(total.kcal)
  const st = streak(data)
  const isToday = date === todayISO()
  const noWeightToday = isToday && !data.weights.some((w) => w.date === date)
  const water = data.water[date] ?? 0
  const pct = Math.min(1, total.kcal / budget)
  const R = 54
  const C = 2 * Math.PI * R

  const setWater = (ml: number) => update((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, ml) } }))
  const removeLog = (id: string) => update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }))

  return (
    <>
      <header className="top datebar">
        <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="前一天">‹</button>
        <h1 onClick={() => setDate(todayISO())}>{date === todayISO() ? '今天' : fmtDate(date)}</h1>
        <button className="icon" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayISO()} aria-label="後一天">›</button>
      </header>
      {isToday && (st > 0 || noWeightToday) && (
        <div className="nudges">
          {st > 0 && <span className="pill">🔥 連續記錄 {st} 天</span>}
          {noWeightToday && <span className="pill soft">⚖️ 今天還沒量體重</span>}
        </div>
      )}

      <section className="card summary">
        <svg viewBox="0 0 128 128" className="ring">
          <circle cx="64" cy="64" r={R} className="ring-bg" />
          <circle
            cx="64" cy="64" r={R}
            className="ring-fg"
            style={{ stroke: left < 0 ? 'var(--bad)' : 'var(--accent)' }}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            transform="rotate(-90 64 64)"
          />
          <text x="64" y="60" textAnchor="middle" className="ring-num">{Math.abs(left)}</text>
          <text x="64" y="80" textAnchor="middle" className="ring-label">{left >= 0 ? '大卡可吃' : '大卡超出'}</text>
        </svg>
        <div className="summary-side">
          <div><small>目標</small><b>{t.kcal}</b></div>
          {exBonus > 0 && <div><small>運動加回</small><b>+{exBonus}</b></div>}
          <div><small>已吃</small><b>{Math.round(total.kcal)}</b></div>
        </div>
      </section>

      <section className="card">
        <Bar label="蛋白質" value={total.protein} goal={t.protein} unit="g" color="#2563eb" />
        <Bar label="碳水" value={total.carbs} goal={t.carbs} unit="g" color="#f59e0b" />
        <Bar label="脂肪" value={total.fat} goal={t.fat} unit="g" color="#db2777" />
      </section>

      <section className="card water">
        <div>
          <b>💧 喝水</b>
          <div className="muted">{water} / 2000 ml</div>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setWater(water - 250)} disabled={water <= 0}>−</button>
          <button className="primary" onClick={() => setWater(water + 250)}>+250</button>
        </div>
      </section>

      {MEALS.map((m) => {
        const items = dayLogs.filter((l) => l.meal === m.key)
        const sub = Math.round(sumLogs(items).kcal)
        return (
          <section className="card meal" key={m.key}>
            <div className="meal-head">
              <b>{m.label}</b>
              <span className="muted">{sub} 大卡</span>
            </div>
            {items.map((l) => (
              <div className="log" key={l.id}>
                <div>
                  <div>{l.name}</div>
                  <small className="muted">{l.servings !== 1 ? `${r1(l.servings)} × ` : ''}{l.unit}</small>
                </div>
                <div className="row">
                  <span>{Math.round(l.kcal * l.servings)}</span>
                  <button className="del" onClick={() => removeLog(l.id)} aria-label="刪除">✕</button>
                </div>
              </div>
            ))}
            <button className="add" onClick={() => setAdding(m.key)}>＋ 新增{m.label}</button>
          </section>
        )
      })}

      <p className="note">熱量與營養數值為估計，僅供參考，不能取代醫療建議。</p>

      {adding && <AddFood store={store} date={date} meal={adding} onClose={() => setAdding(null)} />}
    </>
  )
}
