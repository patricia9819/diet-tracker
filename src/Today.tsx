import { useState } from 'react'
import type { useStore } from './store'
import { MEALS, type Meal } from './types'
import { r1, sortedWeights, sumLogs, targets, todayISO } from './util'
import AddFood from './AddFood'
import { streak } from './habits'
import { dayActivity } from './activity'
import { Icon } from './icons'
import { Bar, DateButton, PageHead, fmt } from './ui'
import { ask } from './dialogs'

type Store = ReturnType<typeof useStore>

const MEAL_ICON: Record<Meal, string> = { breakfast: 'egg', lunch: 'bowl', dinner: 'leaf', snack: 'cup' }

const defaultMeal = (): Meal => {
  const h = new Date().getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

export default function Today({ store, currentKg, goBody }: { store: Store; currentKg: number; goBody: () => void }) {
  const { data, update } = store
  const p = data.profile!
  const [date, setDate] = useState(todayISO())
  const [adding, setAdding] = useState<Meal | null>(null)
  const [open, setOpen] = useState<Meal | null>(null)
  const t = targets(p, currentKg)
  const dayLogs = data.logs.filter((l) => l.date === date)
  const total = sumLogs(dayLogs)
  const act = dayActivity(data, date, currentKg)
  const budget = t.kcal + act.bonus
  const left = budget - Math.round(total.kcal)
  const isToday = date === todayISO()
  const waterGoal = p.waterGoal ?? 2000
  const water = data.water[date] ?? 0
  const rem = p.reminders ?? { weight: true, meals: true, water: true }

  // 今天的小提醒
  const hour = new Date().getHours()
  const has = (m: Meal) => dayLogs.some((l) => l.meal === m)
  const todos: { icon: string; text: string }[] = []
  if (isToday) {
    if (rem.weight && !data.weights.some((w) => w.date === date)) todos.push({ icon: 'scale', text: '還沒量體重' })
    if (rem.meals && hour >= 10 && !has('breakfast')) todos.push({ icon: 'egg', text: '早餐還沒記' })
    if (rem.meals && hour >= 14 && !has('lunch')) todos.push({ icon: 'bowl', text: '午餐還沒記' })
    if (rem.meals && hour >= 20 && !has('dinner')) todos.push({ icon: 'leaf', text: '晚餐還沒記' })
    const should = Math.min(waterGoal, Math.max(0, ((hour - 8) / 12) * waterGoal))
    if (rem.water && hour >= 11 && water < should - 250) todos.push({ icon: 'drop', text: `水喝得有點少，此刻建議約 ${Math.round(should / 250) * 250} ml` })
  }
  const st = streak(data)

  // 今日體重與上一次相比
  const ws = sortedWeights(data.weights).filter((w) => w.date <= date)
  const wToday = ws.length && ws[ws.length - 1].date === date ? ws[ws.length - 1] : null
  const wPrev = wToday ? ws[ws.length - 2] : null
  const delta = wToday && wPrev ? r1(wToday.kg - wPrev.kg) : null

  const setWater = (ml: number) => update((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, ml) } }))
  const removeLog = async (id: string, name: string) => {
    if (await ask(`刪除「${name}」？`, '刪除')) update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }))
  }

  const macros = [
    { icon: 'bean', name: '蛋白質', v: total.protein, goal: t.protein, tone: 'accent' as const },
    { icon: 'drop', name: '脂肪', v: total.fat, goal: t.fat, tone: 'blue' as const },
    { icon: 'wheat', name: '碳水', v: total.carbs, goal: t.carbs, tone: 'blue' as const }
  ]

  return (
    <>
      <PageHead title="飲食日誌" en="Food Journal" right={<DateButton value={date} onChange={setDate} />} />

      <section className="hero-kcal">
        <span className="deco a" aria-hidden="true" /><span className="deco b" aria-hidden="true" />
        <div className="label">{left >= 0 ? (isToday ? '今日剩餘熱量' : '當日剩餘熱量') : '已超出目標'}</div>
        <div className="big">{fmt(Math.abs(left))}<span className="unit">kcal</span></div>
        <div className="hero-bar"><Bar value={total.kcal} max={budget} tone={left < 0 ? 'bad' : 'accent'} /></div>
        <div className="sub">
          已攝取 {fmt(total.kcal)} / 目標 {fmt(budget)} kcal
          {act.bonus > 0 && <span className="muted">（含活動 +{act.bonus}）</span>}
        </div>
      </section>

      {isToday && (st > 0 || todos.length > 0) && (
        <div className="chips">
          {st > 0 && <span className="chip-s accent"><Icon name="flame" size={15} />連續記錄 {st} 天</span>}
          {todos.map((x) => <span key={x.text} className="chip-s"><Icon name={x.icon} size={15} />{x.text}</span>)}
        </div>
      )}

      <section className="block">
        <h2 className="sec">三大營養素</h2>
        {macros.map((m) => (
          <div className="macro" key={m.name}>
            <span className="macro-name"><Icon name={m.icon} size={18} />{m.name}</span>
            <div className="macro-mid">
              <small>{Math.round(m.v)} / {m.goal} g</small>
              <Bar value={m.v} max={m.goal} tone={m.v > m.goal * 1.1 ? 'bad' : m.tone} />
            </div>
            <span className="macro-pct">{m.goal ? Math.round((m.v / m.goal) * 100) : 0}%</span>
          </div>
        ))}
      </section>

      <section className="tiles">
        <div className="tile">
          <div className="tile-head"><Icon name="cup" size={20} /><b>飲水</b></div>
          <div className="tile-val">{fmt(water)} / {fmt(waterGoal)} ml</div>
          <Bar value={water} max={waterGoal} tone="blue" />
          <div className="tile-actions">
            <button className="mini" onClick={() => setWater(water - 250)} disabled={water <= 0} aria-label="減少 250 毫升"><Icon name="minus" size={16} /></button>
            <button className="mini fill" onClick={() => setWater(water + 250)}>+250</button>
          </div>
        </div>
        <button className="tile" onClick={goBody}>
          <div className="tile-head"><Icon name="scale" size={20} /><b>{isToday ? '今日體重' : '當日體重'}</b></div>
          {wToday ? (
            <>
              <div className="tile-big">{wToday.kg}<span className="unit">kg</span></div>
              {delta !== null && delta !== 0 && <div className={delta < 0 ? 'delta down' : 'delta up'}>{delta < 0 ? '▼' : '▲'} {delta > 0 ? '+' : ''}{delta} kg</div>}
            </>
          ) : (
            <div className="tile-empty">尚未記錄<span>前往記錄 <Icon name="chevron" size={14} /></span></div>
          )}
        </button>
      </section>

      <section className="block">
        <div className="sec-row">
          <h2 className="sec">{isToday ? '今日飲食' : '當日飲食'}</h2>
          <button className="link-add" onClick={() => setAdding(defaultMeal())}><Icon name="plus" size={16} />新增餐點</button>
        </div>
        {MEALS.map((m) => {
          const items = dayLogs.filter((l) => l.meal === m.key)
          const sub = Math.round(sumLogs(items).kcal)
          const thumb = data.photos?.[date]?.[m.key]
          const isOpen = open === m.key
          return (
            <div className={isOpen ? 'meal open' : 'meal'} key={m.key}>
              <button className="meal-row" onClick={() => (items.length ? setOpen(isOpen ? null : m.key) : setAdding(m.key))} aria-expanded={isOpen}>
                {thumb ? <img className="thumb" src={thumb} alt="" /> : <span className="thumb ph"><Icon name={MEAL_ICON[m.key]} size={22} /></span>}
                <span className="meal-name">{m.label}</span>
                <span className="meal-kcal">{items.length ? `${fmt(sub)} kcal` : <em>點此新增</em>}</span>
                <Icon name="chevron" size={18} className="chev" />
              </button>
              {isOpen && (
                <div className="meal-items">
                  {items.map((l) => (
                    <div className="item" key={l.id}>
                      <div className="grow">
                        <div>{l.name}</div>
                        <small className="muted">{l.servings === 1 ? '' : l.servings < 1 ? `吃了約 ${Math.round(l.servings * 100)}%・` : `${r1(l.servings)} × `}{l.unit}</small>
                      </div>
                      <span className="num">{fmt(l.kcal * l.servings)}</span>
                      <button className="icon-btn sm" onClick={() => removeLog(l.id, l.name)} aria-label={`刪除 ${l.name}`}><Icon name="close" size={16} /></button>
                    </div>
                  ))}
                  <button className="link-add" onClick={() => setAdding(m.key)}><Icon name="plus" size={16} />新增{m.label}</button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <p className="note">熱量與營養數值為估計，僅供參考，不能取代醫療建議。</p>

      {adding && <AddFood store={store} date={date} meal={adding} onClose={() => setAdding(null)} />}
    </>
  )
}
