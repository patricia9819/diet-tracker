import { useState } from 'react'
import type { useStore } from './store'
import { MEALS, mealPhotos, type LogEntry, type Meal } from './types'
import { r1, sortedWeights, sumLogs, targets, todayISO } from './util'
import AddFood from './AddFood'
import { streak } from './habits'
import { dayActivity } from './activity'
import { Icon } from './icons'
import { Bar, DateButton, PageHead, Sheet, fmt } from './ui'
import { ask } from './dialogs'
import WaterPlant from './WaterPlant'

type Store = ReturnType<typeof useStore>

const MEAL_ICON: Record<Meal, string> = { breakfast: 'egg', lunch: 'bowl', dinner: 'leaf', snack: 'cup' }

const defaultMeal = (): Meal => {
  const h = new Date().getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

export default function Today({ store, currentKg, goBody, goGarden }: { store: Store; currentKg: number; goBody: () => void; goGarden: () => void }) {
  const { data, update } = store
  const p = data.profile!
  const [date, setDate] = useState(todayISO())
  const [adding, setAdding] = useState<Meal | null>(null)
  const [open, setOpen] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const [viewing, setViewing] = useState<{ meal: Meal; i: number } | null>(null)
  const t = targets(p, currentKg)
  const dayLogs = data.logs.filter((l) => l.date === date)
  const total = sumLogs(dayLogs)
  const act = dayActivity(data, date, currentKg)
  const budget = t.kcal + act.bonus
  const left = budget - Math.round(total.kcal)
  const isToday = date === todayISO()
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
  }
  const st = streak(data)

  // 今日體重與上一次相比
  const ws = sortedWeights(data.weights).filter((w) => w.date <= date)
  const wToday = ws.length && ws[ws.length - 1].date === date ? ws[ws.length - 1] : null
  const wPrev = wToday ? ws[ws.length - 2] : null
  const delta = wToday && wPrev ? r1(wToday.kg - wPrev.kg) : null

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

      <WaterPlant store={store} date={date} onOpen={goGarden} />

      <button className="weight-row" onClick={goBody}>
        <Icon name="scale" size={22} />
        <span className="grow">{isToday ? '今日體重' : '當日體重'}</span>
        {wToday ? (
          <>
            <span className="weight-val">{wToday.kg}<small>kg</small></span>
            {delta !== null && delta !== 0 && <span className={delta < 0 ? 'delta down' : 'delta up'}>{delta < 0 ? '▼' : '▲'} {delta > 0 ? '+' : ''}{delta}</span>}
          </>
        ) : <span className="muted small">尚未記錄</span>}
        <Icon name="chevron" size={18} className="chev" />
      </button>

      <section className="block">
        <div className="sec-row">
          <h2 className="sec">{isToday ? '今日飲食' : '當日飲食'}</h2>
          <button className="link-add" onClick={() => setAdding(defaultMeal())}><Icon name="plus" size={16} />新增餐點</button>
        </div>
        {MEALS.map((m) => {
          const items = dayLogs.filter((l) => l.meal === m.key)
          const sub = Math.round(sumLogs(items).kcal)
          const pics = mealPhotos(data, date, m.key)
          const thumb = pics[0]
          const isOpen = open === m.key
          return (
            <div className={isOpen ? 'meal open' : 'meal'} key={m.key}>
              <button className="meal-row" onClick={() => (items.length ? setOpen(isOpen ? null : m.key) : setAdding(m.key))} aria-expanded={isOpen}>
                {thumb ? <span className="thumb-wrap"><img className="thumb" src={thumb} alt="" />{pics.length > 1 && <em className="thumb-n">{pics.length}</em>}</span> : <span className="thumb ph"><Icon name={MEAL_ICON[m.key]} size={22} /></span>}
                <span className="meal-name">{m.label}</span>
                <span className="meal-kcal">{items.length ? `${fmt(sub)} kcal` : <em>點此新增</em>}</span>
                <Icon name="chevron" size={18} className="chev" />
              </button>
              {isOpen && (
                <div className="meal-items">
                  {pics.length > 0 && (
                    <div className="meal-pics">
                      {pics.map((src, i) => <button key={i} onClick={() => setViewing({ meal: m.key, i })} aria-label={`看第 ${i + 1} 張照片`}><img src={src} alt="" /></button>)}
                    </div>
                  )}
                  {items.map((l) => (
                    <div className="item" key={l.id}>
                      <button className="grow item-edit" onClick={() => setEditing(l)} aria-label={`修改 ${l.name}`}>
                        <div>{l.name}</div>
                        <small className="muted">{l.servings === 1 ? '' : l.servings < 1 ? `吃了約 ${Math.round(l.servings * 100)}%・` : `${r1(l.servings)} × `}{l.unit}<Icon name="pencil" size={12} className="edit-hint" /></small>
                      </button>
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

      {editing && <EditLog store={store} log={editing} onClose={() => setEditing(null)} />}
      {viewing && (() => {
        const pics = mealPhotos(data, date, viewing.meal)
        const src = pics[viewing.i]
        if (!src) return null
        return (
          <Sheet title={`${MEALS.find((x) => x.key === viewing.meal)!.label}照片 ${viewing.i + 1} / ${pics.length}`} onClose={() => setViewing(null)}>
            <img className="photo-big" src={src} alt="" />
            <div className="row between" style={{ marginTop: 12 }}>
              <button className="ghost" disabled={viewing.i === 0} onClick={() => setViewing({ ...viewing, i: viewing.i - 1 })}><Icon name="chevronLeft" size={16} />上一張</button>
              <button className="ghost" onClick={async () => {
                if (!(await ask('刪除這張照片？（不會刪除食物紀錄）', '刪除'))) return
                update((d) => ({ ...d, photos: { ...d.photos, [date]: { ...d.photos[date], [viewing.meal]: mealPhotos(d, date, viewing.meal).filter((_, j) => j !== viewing.i) } } }))
                setViewing(pics.length > 1 ? { ...viewing, i: Math.max(0, viewing.i - 1) } : null)
              }}><Icon name="trash" size={16} />刪除</button>
              <button className="ghost" disabled={viewing.i >= pics.length - 1} onClick={() => setViewing({ ...viewing, i: viewing.i + 1 })}>下一張<Icon name="chevron" size={16} /></button>
            </div>
          </Sheet>
        )
      })()}
      {adding && <AddFood store={store} date={date} meal={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

/** 修改一筆食物紀錄：名稱、份量、每份的熱量與營養素、餐別 */
function EditLog({ store, log, onClose }: { store: Store; log: LogEntry; onClose: () => void }) {
  const [f, setF] = useState({
    name: log.name, unit: log.unit, servings: String(r1(log.servings)), meal: log.meal,
    kcal: String(Math.round(log.kcal)), protein: String(r1(log.protein)), carbs: String(r1(log.carbs)), fat: String(r1(log.fat))
  })
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : 0 }
  const sv = num(f.servings)
  const save = () => {
    if (!f.name.trim()) return
    if (!(sv > 0)) return
    store.update((d) => ({ ...d, logs: d.logs.map((l) => (l.id === log.id ? { ...l, name: f.name.trim(), unit: f.unit.trim() || '1 份', servings: sv, meal: f.meal, kcal: num(f.kcal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat) } : l)) }))
    onClose()
  }
  const remove = async () => {
    if (await ask(`刪除「${log.name}」？`, '刪除')) { store.update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== log.id) })); onClose() }
  }
  const field = (k: 'kcal' | 'protein' | 'carbs' | 'fat', label: string) => (
    <label className="field">{label}<input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )
  return (
    <Sheet title="修改食物" onClose={onClose}>
      <div className="form">
        <label className="field">名稱<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field">一份是多少<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="例如 1 碗約 200g" /></label>
        <label className="field">吃了幾份
          <div className="row">
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map((v) => <button type="button" key={v} className={sv === v ? 'chip on' : 'chip'} onClick={() => setF({ ...f, servings: String(v) })}>{v}</button>)}
            <input inputMode="decimal" value={f.servings} onChange={(e) => setF({ ...f, servings: e.target.value })} aria-label="份數" />
          </div>
        </label>
        <h3 className="sec">每份的營養</h3>
        <div className="grid2">{field('kcal', '熱量（大卡）')}{field('protein', '蛋白質（g）')}{field('carbs', '碳水（g）')}{field('fat', '脂肪（g）')}</div>
        <label className="field">哪一餐
          <div className="row">{MEALS.map((m) => <button type="button" key={m.key} className={f.meal === m.key ? 'chip on' : 'chip'} onClick={() => setF({ ...f, meal: m.key })}>{m.label}</button>)}</div>
        </label>
        <div className="preview">合計 <b className="accent-num">{fmt(num(f.kcal) * sv)}</b> 大卡・蛋白質 {r1(num(f.protein) * sv)} g・碳水 {r1(num(f.carbs) * sv)} g・脂肪 {r1(num(f.fat) * sv)} g</div>
        <div className="btn-pair">
          <button className="btn-line" onClick={remove}><Icon name="trash" size={16} />刪除</button>
          <button className="btn-dark" onClick={save}>儲存</button>
        </div>
      </div>
    </Sheet>
  )
}
