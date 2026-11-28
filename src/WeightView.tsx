import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { useStore } from './store'
import { addDays, bmi, bmiLabel, fmtDate, r1, sortedWeights, todayISO, withMovingAvg } from './util'
import { ask, toast } from './dialogs'
import { Icon } from './icons'
import { Bar, PageHead, Seg, Sheet } from './ui'

type Store = ReturnType<typeof useStore>
type Metric = 'kg' | 'fat' | 'bmi'

export default function WeightView({ store }: { store: Store }) {
  const { data, update } = store
  const p = data.profile!
  const [metric, setMetric] = useState<Metric>('kg')
  const [range, setRange] = useState<30 | 90 | 0>(30)
  const [entry, setEntry] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const ws = sortedWeights(data.weights)
  const avg = withMovingAvg(data.weights)
  const first = ws[0]
  const last = ws[ws.length - 1]
  const prev = ws[ws.length - 2]

  // 依指標整理資料
  const from = range ? addDays(todayISO(), -range) : ''
  const series = (metric === 'kg'
    ? avg.map((e) => ({ date: e.date, v: e.kg, avg: e.avg }))
    : metric === 'bmi'
      ? avg.map((e) => ({ date: e.date, v: r1(bmi(p, e.kg)), avg: r1(bmi(p, e.avg)) }))
      : ws.filter((e) => e.bodyFat != null).map((e) => ({ date: e.date, v: e.bodyFat!, avg: e.bodyFat! }))
  ).filter((e) => e.date >= from)

  const fatList = ws.filter((e) => e.bodyFat != null)
  const cur = metric === 'kg' ? last?.kg : metric === 'bmi' ? (last ? r1(bmi(p, last.kg)) : undefined) : fatList[fatList.length - 1]?.bodyFat
  const before = metric === 'kg' ? prev?.kg : metric === 'bmi' ? (prev ? r1(bmi(p, prev.kg)) : undefined) : fatList[fatList.length - 2]?.bodyFat
  const delta = cur != null && before != null ? r1(cur - before) : null
  const unit = metric === 'kg' ? 'kg' : metric === 'fat' ? '%' : ''
  const goalLine = metric === 'kg' ? p.goalWeight : metric === 'bmi' ? r1(bmi(p, p.goalWeight)) : undefined

  const progress = first && last && first.kg > p.goalWeight ? Math.max(0, Math.min(1, (first.kg - last.kg) / (first.kg - p.goalWeight))) : last && last.kg <= p.goalWeight ? 1 : 0
  const ys = series.flatMap((e) => [e.v, e.avg]).concat(goalLine != null ? [goalLine] : [])
  const pad = metric === 'kg' ? 1 : 0.5
  const domain: [number, number] = ys.length ? [Math.floor(Math.min(...ys) - pad), Math.ceil(Math.max(...ys) + pad)] : [0, 1]

  const remove = async (dt: string) => {
    if (await ask(`刪除 ${fmtDate(dt)} 的體重紀錄？`, '刪除')) update((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== dt) }))
  }

  return (
    <>
      <PageHead title="體態紀錄" en="Body Notes" />
      <Seg label="指標" value={metric} onChange={setMetric} options={[{ v: 'kg', label: '體重' }, { v: 'fat', label: '體脂' }, { v: 'bmi', label: 'BMI' }]} />

      <section className="metric-head">
        <div className="label">{metric === 'kg' ? '目前體重' : metric === 'fat' ? '目前體脂率' : '目前 BMI'}</div>
        <div className="metric-row">
          <div className="big">{cur ?? '—'}<span className="unit">{unit}</span></div>
          {delta !== null && delta !== 0 && <span className={delta < 0 ? 'delta-chip down' : 'delta-chip up'}>{delta < 0 ? '▼' : '▲'} {delta > 0 ? '+' : ''}{delta}{unit && ' ' + unit}（較上次）</span>}
        </div>
        {metric === 'kg' && <div className="goal-note">目標 {p.goalWeight.toFixed(1)} kg</div>}
        {metric === 'bmi' && cur != null && <div className="goal-note">{bmiLabel(cur)}（目標 {goalLine}）</div>}
      </section>

      <section className="chart">
        {series.length >= 2 ? (
          <div style={{ height: 210 }}>
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => `${+d.slice(5, 7)}/${+d.slice(8)}`} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis domain={domain} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} labelFormatter={(d) => fmtDate(String(d))} formatter={(v, n) => [`${v}${unit && ' ' + unit}`, n === 'avg' ? '7 日平均' : '當天']} />
                {goalLine != null && <ReferenceLine y={goalLine} stroke="var(--blue)" strokeDasharray="4 4" />}
                <Area dataKey="avg" type="monotone" stroke="var(--accent)" strokeWidth={2} fill="url(#g-area)" dot={{ r: 3, fill: 'var(--card)', stroke: 'var(--accent)', strokeWidth: 1.5 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty">{metric === 'fat' ? '記錄體重時一併填體脂，就會出現體脂趨勢。' : '記錄兩天以上就會出現趨勢圖。'}</p>
        )}
        <div className="range">
          {([30, 90, 0] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r ? `${r} 天` : '全部'}</button>)}
        </div>
      </section>

      {last && (
        <section className="trio">
          <div><small>起始</small><b>{first.kg.toFixed(1)}<span>kg</span></b></div>
          <div><small>目前</small><b>{last.kg.toFixed(1)}<span>kg</span></b></div>
          <div><small>目標</small><b>{p.goalWeight.toFixed(1)}<span>kg</span></b></div>
        </section>
      )}

      <section className="block">
        <div className="sec-row"><h2 className="sec">達成進度</h2><span className="pct">{Math.round(progress * 100)}%</span></div>
        <Bar value={progress} max={1} />
      </section>

      <button className="btn-dark" onClick={() => setEntry(true)}>記錄體重 <Icon name="plus" size={18} /></button>

      {ws.length > 0 && (
        <section className="block">
          <h2 className="sec">紀錄</h2>
          {[...ws].reverse().slice(0, showAll ? undefined : 7).map((e) => (
            <div className="item" key={e.date}>
              <span className="grow">{fmtDate(e.date)}</span>
              <span className="num">{e.kg} kg{e.bodyFat != null && <small className="muted">・{e.bodyFat}%</small>}</span>
              <button className="icon-btn sm" onClick={() => remove(e.date)} aria-label={`刪除 ${fmtDate(e.date)}`}><Icon name="close" size={16} /></button>
            </div>
          ))}
          {ws.length > 7 && <button className="link-add" onClick={() => setShowAll(!showAll)}>{showAll ? '收起' : `看全部 ${ws.length} 筆`}</button>}
          <p className="note">趨勢圖是 7 日平均，比單日數字更能看出真實變化（每天的水分波動很正常）。</p>
        </section>
      )}

      {entry && <WeightEntry store={store} onClose={() => setEntry(false)} />}
    </>
  )
}

function WeightEntry({ store, onClose }: { store: Store; onClose: () => void }) {
  const last = sortedWeights(store.data.weights).pop()
  const [date, setDate] = useState(todayISO())
  const [kg, setKg] = useState('')
  const [bf, setBf] = useState('')
  const save = () => {
    const v = parseFloat(kg)
    if (!isFinite(v) || v < 20 || v > 400) return toast('請輸入正確的體重')
    const b = parseFloat(bf)
    store.update((d) => ({ ...d, weights: [...d.weights.filter((w) => w.date !== date), { date, kg: v, ...(isFinite(b) ? { bodyFat: b } : {}) }] }))
    toast(`已記錄 ${v} kg`)
    onClose()
  }
  return (
    <Sheet title="記錄體重" onClose={onClose}>
      <div className="grid2">
        <label className="field">日期<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field">體重 (kg)<input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={last ? String(last.kg) : ''} autoFocus /></label>
        <label className="field">體脂 %（選填）<input inputMode="decimal" value={bf} onChange={(e) => setBf(e.target.value)} placeholder={last?.bodyFat ? String(last.bodyFat) : ''} /></label>
      </div>
      <p className="note">建議每天早上起床、如廁後、吃早餐前量，比較準。</p>
      <button className="btn-dark" onClick={save}>儲存</button>
    </Sheet>
  )
}
