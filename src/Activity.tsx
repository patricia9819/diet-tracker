import { useRef, useState } from 'react'
import type { useStore } from './store'
import { ACTIVITIES } from './exercise-data'
import { addDays, fmtDate, parseISO, sortedWeights, todayISO, uid } from './util'
import { dayActivity, STEP_BASELINE } from './activity'
import { friendlyError, readSteps, type StepRead } from './ai'
import { ask, toast } from './dialogs'
import { Icon } from './icons'
import { Bar, DateButton, PageHead, Seg, Sheet, dateLabel, fmt } from './ui'

type Store = ReturnType<typeof useStore>
type Range = 'week' | 'month' | 'quarter'

export default function Activity({ store }: { store: Store }) {
  const { data, update } = store
  const p = data.profile!
  const kg = sortedWeights(data.weights).pop()?.kg ?? p.goalWeight
  const goal = p.stepGoal ?? 8000
  const [date, setDate] = useState(todayISO())
  const [range, setRange] = useState<Range>('week')
  const [sheet, setSheet] = useState<'import' | 'manual' | 'exercise' | null>(null)

  const a = dayActivity(data, date, kg)
  const st = data.steps?.[date]
  const exs = data.exercises.filter((e) => e.date === date)
  const isToday = date === todayISO()

  // 統計區間
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 91
  const list = Array.from({ length: days }, (_, i) => addDays(todayISO(), i - days + 1))
  const stepsOf = (d: string) => data.steps?.[d]?.steps ?? 0
  const totSteps = list.reduce((s, d) => s + stepsOf(d), 0)
  const logged = list.filter((d) => stepsOf(d) > 0).length
  const totKcal = list.reduce((s, d) => s + dayActivity(data, d, kg).total, 0)
  // 近三月以週為單位
  const bars = range === 'quarter'
    ? Array.from({ length: 13 }, (_, w) => {
        const ds = list.slice(w * 7, w * 7 + 7)
        const n = ds.filter((d) => stepsOf(d) > 0).length
        return { key: ds[0], label: `${+ds[0].slice(5, 7)}/${+ds[0].slice(8)}`, v: n ? ds.reduce((s, d) => s + stepsOf(d), 0) / n : 0, hit: false }
      })
    : list.map((d) => ({ key: d, label: range === 'week' ? '日一二三四五六'[parseISO(d).getDay()] : String(+d.slice(8)), v: stepsOf(d), hit: stepsOf(d) >= goal }))

  const removeSteps = async () => {
    if (await ask(`刪除 ${fmtDate(date)} 的步數？`, '刪除')) update((d) => { const s = { ...d.steps }; delete s[date]; return { ...d, steps: s } })
  }
  const removeEx = async (id: string, name: string) => {
    if (await ask(`刪除「${name}」？`, '刪除')) update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }))
  }

  return (
    <>
      <PageHead title="日常活動" en="Movement" right={<DateButton value={date} onChange={setDate} />} />

      <section className="hero-move">
        <Leaves />
        <div className="duo">
          <div><div className="label">步數</div><div className="big">{fmt(a.steps)}<span className="unit">步</span></div></div>
          <div className="vr" aria-hidden="true" />
          <div><div className="label">消耗熱量</div><div className="big">{fmt(a.total)}<span className="unit">kcal</span></div></div>
        </div>
        <div className="hero-bar"><Bar value={a.steps} max={goal} /></div>
        <div className="sub">
          目標 {fmt(goal)} 步・{a.steps >= goal ? '今天達標了！' : `還差 ${fmt(goal - a.steps)} 步`}
          {a.bonus > 0 && <span className="muted">・可多吃 {a.bonus} kcal</span>}
        </div>
      </section>

      <div className="btn-pair">
        <button className="btn-soft" onClick={() => setSheet('import')}><Icon name="image" size={18} />匯入步數截圖</button>
        <button className="btn-line" onClick={() => setSheet('manual')}><Icon name="pencil" size={18} />手動輸入</button>
      </div>

      <section className="block">
        <div className="sec-row">
          <h2 className="sec">{isToday ? '今日活動紀錄' : '當日活動紀錄'}</h2>
          <button className="link-add" onClick={() => setSheet('exercise')}><Icon name="plus" size={16} />新增運動</button>
        </div>
        {st && (
          <div className="act">
            <span className="act-icon"><Icon name="walk" size={24} /></span>
            <div className="grow">
              <b>走路</b>
              <small>{fmt(st.steps)} 步{st.km ? `・${st.km} km` : ''}・{a.walk} kcal・{st.source === 'screenshot' ? '截圖匯入' : '手動輸入'}</small>
            </div>
            <button className="icon-btn sm" onClick={removeSteps} aria-label="刪除步數"><Icon name="close" size={16} /></button>
          </div>
        )}
        {exs.map((e) => (
          <div className="act" key={e.id}>
            <span className="act-icon"><Icon name="dumbbell" size={24} /></span>
            <div className="grow"><b>{e.name}</b><small>{e.minutes ? `${e.minutes} min・` : ''}{e.kcal} kcal</small></div>
            <button className="icon-btn sm" onClick={() => removeEx(e.id, e.name)} aria-label={`刪除 ${e.name}`}><Icon name="close" size={16} /></button>
          </div>
        ))}
        {!st && !exs.length && <p className="empty">還沒有紀錄。截一張健康 App 或 Garmin 的步數畫面匯入最快。</p>}
      </section>

      <section className="block">
        <h2 className="sec">活動統計</h2>
        <Seg label="統計區間" value={range} onChange={setRange} options={[{ v: 'week', label: '本週' }, { v: 'month', label: '本月' }, { v: 'quarter', label: '近三月' }]} />
        <div className="stat-row">
          <div><small>總步數</small><b>{fmt(totSteps)}<span>步</span></b></div>
          <div><small>平均每日</small><b>{fmt(logged ? totSteps / logged : 0)}<span>步</span></b></div>
          <div><small>消耗熱量</small><b>{fmt(totKcal)}<span>kcal</span></b></div>
        </div>
        <StepBars bars={bars} goal={goal} />
      </section>

      <p className="note">
        每天約 {fmt(STEP_BASELINE)} 步的日常走動已算在每日消耗裡；超過的部分和運動，會依「我的 → 個人資料與目標」設定的比例加回可吃的熱量。
      </p>

      {sheet === 'import' && <StepImport store={store} onClose={() => setSheet(null)} />}
      {sheet === 'manual' && <StepManual store={store} date={date} onClose={() => setSheet(null)} />}
      {sheet === 'exercise' && <ExerciseAdd store={store} date={date} kg={kg} onClose={() => setSheet(null)} />}
    </>
  )
}

/** 背景的葉影裝飾 */
function Leaves() {
  return (
    <svg className="leaves" viewBox="0 0 200 140" aria-hidden="true">
      <g fill="currentColor">
        <path d="M150 10c22 4 36 18 40 40-22-2-38-16-40-40z" />
        <path d="M120 30c18 8 26 22 24 42-18-6-28-20-24-42z" opacity=".7" />
        <path d="M170 60c16 8 24 22 22 40-16-6-26-20-22-40z" opacity=".8" />
        <path d="M100 0c14 10 18 24 12 40-12-10-16-24-12-40z" opacity=".5" />
      </g>
      <path d="M95 -5C130 30 160 60 205 110" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".6" />
    </svg>
  )
}

function StepBars({ bars, goal }: { bars: { key: string; label: string; v: number; hit: boolean }[]; goal: number }) {
  const W = 320, H = 150, top = 10, bottom = 22, left = 30
  const max = Math.max(goal, ...bars.map((b) => b.v)) * 1.1
  const ticks = [0, max / 3, (max * 2) / 3].map((v) => Math.round(v / 1000) * 1000).filter((v, i, a) => a.indexOf(v) === i)
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max)
  const bw = (W - left) / bars.length
  const every = bars.length > 14 ? Math.ceil(bars.length / 8) : 1
  return (
    <svg className="bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="每日步數長條圖">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="grid" />
          <text x={left - 6} y={y(t) + 3} textAnchor="end" className="tick">{t >= 1000 ? `${t / 1000}k` : t}</text>
        </g>
      ))}
      <line x1={left} x2={W} y1={y(goal)} y2={y(goal)} className="goal" />
      {bars.map((b, i) => {
        const x = left + i * bw + bw * 0.2
        const h = b.v ? Math.max(2, y(0) - y(b.v)) : 0
        return (
          <g key={b.key}>
            {h > 0 && <rect x={x} y={y(0) - h} width={bw * 0.6} height={h} rx={Math.min(3, bw * 0.2)} className={b.hit ? 'bar hit' : 'bar'} />}
            {i % every === 0 && <text x={x + bw * 0.3} y={H - 6} textAnchor="middle" className="tick">{b.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function StepImport({ store, onClose }: { store: Store; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<{ days: StepRead[]; source: string; note: string } | null>(null)
  const [sel, setSel] = useState<boolean[]>([])
  const existing = store.data.steps ?? {}

  const run = async (file: File) => {
    setBusy(true); setErr(''); setRes(null)
    try {
      const r = await readSteps(file, todayISO())
      r.days.sort((a, b) => b.date.localeCompare(a.date))
      setRes(r); setSel(r.days.map(() => true))
    } catch (e) { setErr(friendlyError(e)) }
    setBusy(false)
  }
  const setSteps = (i: number, v: string) => setRes(res && { ...res, days: res.days.map((d, j) => (j === i ? { ...d, steps: Math.max(0, Math.round(Number(v.replace(/\D/g, '')) || 0)) } : d)) })
  const save = () => {
    if (!res) return
    const chosen = res.days.filter((_, i) => sel[i] && res.days[i].steps > 0)
    store.update((d) => ({ ...d, steps: { ...d.steps, ...Object.fromEntries(chosen.map((x) => [x.date, { steps: x.steps, ...(x.km ? { km: x.km } : {}), source: 'screenshot' as const }])) } }))
    toast(`已匯入 ${chosen.length} 天的步數`)
    onClose()
  }

  return (
    <Sheet title="匯入步數截圖" onClose={onClose}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(f) }} />
      {!res && (
        <>
          <ol className="steps-howto">
            <li><b>iPhone 健康 App</b>：瀏覽 → 活動 → 步數 → 選「週」，截圖。</li>
            <li><b>Garmin Connect</b>：首頁的「步數」卡片 → 切到「7 天」，截圖。</li>
            <li>回到這裡選那張截圖，Claude 會讀出每一天的步數。</li>
          </ol>
          <p className="note">一週的截圖可以一次補齊 7 天。網頁 App 無法直接連到健康 App 或 Garmin，所以用截圖匯入。</p>
          <button className="btn-dark" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Claude 讀取中，約 10–40 秒…' : <><Icon name="image" size={18} />選擇截圖</>}
          </button>
        </>
      )}
      {err && <div className="alert">{err}</div>}
      {res && (
        <>
          {res.source && <p className="muted small">來源：{res.source}</p>}
          {res.days.length === 0 && <p>{res.note || '沒有讀到步數，請換一張截圖。'}</p>}
          {res.days.map((d, i) => (
            <label className="item" key={d.date}>
              <input type="checkbox" checked={sel[i]} onChange={(e) => setSel(sel.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span className="grow">{dateLabel(d.date)}{existing[d.date] && <small className="muted">（取代 {fmt(existing[d.date].steps)} 步）</small>}</span>
              <input className="inline steps-in" inputMode="numeric" value={d.steps} onChange={(e) => setSteps(i, e.target.value)} aria-label={`${d.date} 步數`} />
              <span className="muted small">步</span>
            </label>
          ))}
          {res.note && res.days.length > 0 && <p className="note">{res.note}</p>}
          <div className="btn-pair">
            <button className="btn-line" onClick={() => fileRef.current?.click()}>換一張</button>
            <button className="btn-dark" onClick={save} disabled={!sel.some(Boolean)}>匯入</button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function StepManual({ store, date: d0, onClose }: { store: Store; date: string; onClose: () => void }) {
  const cur = store.data.steps?.[d0]
  const [date, setDate] = useState(d0)
  const [steps, setSteps] = useState(cur ? String(cur.steps) : '')
  const [km, setKm] = useState(cur?.km ? String(cur.km) : '')
  const save = () => {
    const n = Math.round(Number(steps))
    if (!(n > 0 && n < 200000)) return toast('請輸入步數')
    const k = parseFloat(km)
    store.update((d) => ({ ...d, steps: { ...d.steps, [date]: { steps: n, ...(k > 0 ? { km: k } : {}), source: 'manual' } } }))
    toast(`已記錄 ${fmt(n)} 步`)
    onClose()
  }
  return (
    <Sheet title="手動輸入步數" onClose={onClose}>
      <div className="grid2">
        <label className="field">日期<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field">步數<input inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
        <label className="field">距離 km（選填）<input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></label>
      </div>
      <button className="btn-dark" onClick={save}>儲存</button>
    </Sheet>
  )
}

function ExerciseAdd({ store, date: d0, kg, onClose }: { store: Store; date: string; kg: number; onClose: () => void }) {
  const [date, setDate] = useState(d0)
  const [act, setAct] = useState(ACTIVITIES[1].name)
  const [min, setMin] = useState('30')
  const [manual, setManual] = useState('')
  const [custom, setCustom] = useState('')
  const met = ACTIVITIES.find((x) => x.name === act)?.met ?? 0
  const est = Math.round((met * kg * (parseFloat(min) || 0)) / 60)
  const kcal = manual ? Math.max(0, Math.round(parseFloat(manual) || 0)) : est
  const save = () => {
    const name = act === '其他' ? custom.trim() || '其他運動' : act
    if (!kcal) return toast('請輸入時間或消耗熱量')
    store.update((d) => ({ ...d, exercises: [...d.exercises, { id: uid(), date, name, minutes: parseFloat(min) || 0, kcal }] }))
    toast(`已記錄${name} ${kcal} kcal`)
    onClose()
  }
  return (
    <Sheet title="新增運動" onClose={onClose}>
      <div className="grid2">
        <label className="field">日期<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field">運動
          <select value={act} onChange={(e) => setAct(e.target.value)}>
            {ACTIVITIES.map((x) => <option key={x.name}>{x.name}</option>)}
            <option>其他</option>
          </select>
        </label>
        {act === '其他' && <label className="field">名稱<input value={custom} onChange={(e) => setCustom(e.target.value)} /></label>}
        <label className="field">時間 (分鐘)<input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></label>
        <label className="field">消耗 (kcal)<input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={act === '其他' ? '請輸入' : `估計 ${est}`} /></label>
      </div>
      <p className="note">走路請用「匯入步數截圖」，這裡記錄其他運動。有運動手錶的話可以直接填手錶顯示的消耗。</p>
      <button className="btn-dark" onClick={save}>記錄 {kcal} kcal</button>
    </Sheet>
  )
}

