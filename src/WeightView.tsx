import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { useStore } from './store'
import { ask, toast } from './dialogs'
import { addDays, bmi, bmiLabel, fmtDate, r1, todayISO, withMovingAvg } from './util'

type Store = ReturnType<typeof useStore>

export default function WeightView({ store }: { store: Store }) {
  const { data, update } = store
  const p = data.profile!
  const [date, setDate] = useState(todayISO())
  const [kg, setKg] = useState('')
  const [bf, setBf] = useState('')
  const [range, setRange] = useState<30 | 90 | 0>(30)

  const series = withMovingAvg(data.weights)
  const shown = range ? series.filter((e) => e.date >= addDays(todayISO(), -range)) : series
  const first = series[0]
  const last = series[series.length - 1]

  // 最近 14 天平均的變化速度（kg/週）
  let rate: number | null = null
  if (last) {
    const past = series.filter((e) => e.date <= addDays(last.date, -14)).pop()
    if (past) rate = ((last.avg - past.avg) / 14) * 7
  }

  const save = () => {
    const v = parseFloat(kg)
    if (!isFinite(v) || v < 20 || v > 400) return toast('請輸入正確的體重')
    const b = parseFloat(bf)
    update((d) => ({
      ...d,
      weights: [...d.weights.filter((w) => w.date !== date), { date, kg: v, ...(isFinite(b) ? { bodyFat: b } : {}) }]
    }))
    setKg('')
    setBf('')
    toast('已記錄 ' + v + ' kg')
  }

  const remove = async (dt: string) => {
    if (await ask(`刪除 ${fmtDate(dt)} 的體重紀錄？`, '刪除')) update((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== dt) }))
  }

  const toGoal = last ? r1(last.avg - p.goalWeight) : null
  const ys = shown.flatMap((e) => [e.kg, e.avg]).concat(p.goalWeight)
  const domain = ys.length ? [Math.floor(Math.min(...ys) - 1), Math.ceil(Math.max(...ys) + 1)] : ['auto', 'auto']

  return (
    <>
      <header className="top"><h1>體重</h1></header>

      <section className="card">
        <div className="grid2">
          <label className="field">日期<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field">體重 (kg)<input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={last ? String(last.kg) : ''} /></label>
          <label className="field">體脂 %（選填）<input inputMode="decimal" value={bf} onChange={(e) => setBf(e.target.value)} /></label>
          <div className="field"><span>&nbsp;</span><button className="primary" onClick={save}>記錄</button></div>
        </div>
      </section>

      {last && (
        <section className="card stats">
          <div><small>目前（7日平均）</small><b>{last.avg}</b><small>kg</small></div>
          <div><small>總變化</small><b>{r1(last.avg - first.kg) > 0 ? '+' : ''}{r1(last.avg - first.kg)}</b><small>kg</small></div>
          <div><small>距離目標</small><b>{toGoal! > 0 ? toGoal : '達成 🎉'}</b><small>{toGoal! > 0 ? 'kg' : ''}</small></div>
          <div><small>BMI</small><b>{r1(bmi(p, last.avg))}</b><small>{bmiLabel(bmi(p, last.avg))}</small></div>
          {rate !== null && (
            <div className="wide"><small>近兩週速度</small><b>{rate > 0 ? '+' : ''}{r1(rate)}</b><small>kg／週（目標 −{p.weeklyLossKg}）</small></div>
          )}
        </section>
      )}

      <section className="card">
        <div className="row between">
          <b>趨勢</b>
          <div className="row">
            {([30, 90, 0] as const).map((r) => (
              <button key={r} className={range === r ? 'chip on' : 'chip'} onClick={() => setRange(r)}>{r ? `${r}天` : '全部'}</button>
            ))}
          </div>
        </div>
        {shown.length >= 2 ? (
          <div style={{ height: 240, marginTop: 8 }}>
            <ResponsiveContainer>
              <LineChart data={shown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5).replace('-', '/')} tick={{ fontSize: 11, fill: 'var(--muted)' }} minTickGap={24} />
                <YAxis domain={domain as [number, number]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip labelFormatter={(d) => fmtDate(String(d))} formatter={(v, n) => [`${v} kg`, n === 'avg' ? '7日平均' : '當日']} />
                <ReferenceLine y={p.goalWeight} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: '目標', fontSize: 11, fill: 'var(--accent)', position: 'insideTopRight' }} />
                <Line dataKey="kg" stroke="var(--muted)" strokeOpacity={0.5} dot={{ r: 2 }} strokeWidth={1} isAnimationActive={false} />
                <Line dataKey="avg" stroke="var(--accent)" dot={false} strokeWidth={2.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="muted center">至少記錄兩天後就會出現趨勢圖</p>
        )}
        <p className="note">粗線是 7 日平均，比每天的數字更能反映真實趨勢（每天的水分波動很正常）。</p>
      </section>

      <section className="card">
        <b>紀錄</b>
        {[...series].reverse().map((e) => (
          <div className="log" key={e.date}>
            <span>{fmtDate(e.date)}</span>
            <div className="row">
              <span>{e.kg} kg{e.bodyFat != null && <small className="muted">・{e.bodyFat}%</small>}</span>
              <button className="del" onClick={() => remove(e.date)} aria-label="刪除">✕</button>
            </div>
          </div>
        ))}
        {series.length === 0 && <p className="muted center">還沒有紀錄</p>}
      </section>
    </>
  )
}
