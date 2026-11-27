import { useState } from 'react'
import type { useStore } from './store'
import { ACTIVITIES } from './exercise-data'
import { addDays, fmtDate, sortedWeights, todayISO, uid } from './util'

type Store = ReturnType<typeof useStore>

export default function Exercise({ store }: { store: Store }) {
  const { data, update } = store
  const p = data.profile!
  const ws = sortedWeights(data.weights)
  const kg = ws.length ? ws[ws.length - 1].kg : p.goalWeight
  const [date, setDate] = useState(todayISO())
  const [act, setAct] = useState(ACTIVITIES[1].name)
  const [min, setMin] = useState('30')
  const [manualKcal, setManualKcal] = useState('')
  const [custom, setCustom] = useState('')

  const met = ACTIVITIES.find((a) => a.name === act)?.met ?? 0
  const est = Math.round(met * kg * (parseFloat(min) || 0) / 60)
  const kcal = manualKcal ? Math.max(0, Math.round(parseFloat(manualKcal) || 0)) : est
  const addBack = p.exerciseAddBack ?? 0.5

  const save = () => {
    const name = act === '其他' ? custom.trim() || '其他運動' : act
    if (!kcal) return alert('請輸入時間或消耗熱量')
    update((d) => ({ ...d, exercises: [...d.exercises, { id: uid(), date, name, minutes: parseFloat(min) || 0, kcal }] }))
    setManualKcal('')
  }
  const remove = (id: string) => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) }))

  const recent = [...data.exercises].sort((a, b) => b.date.localeCompare(a.date)).filter((e) => e.date >= addDays(todayISO(), -30))
  const week = data.exercises.filter((e) => e.date > addDays(todayISO(), -7))
  const weekKcal = week.reduce((a, e) => a + e.kcal, 0)
  const weekMin = week.reduce((a, e) => a + e.minutes, 0)

  return (
    <>
      <header className="top"><h1>運動</h1></header>

      <section className="card stats">
        <div><small>近 7 天運動</small><b>{weekMin}</b><small>分鐘（建議每週 150 分鐘）</small></div>
        <div><small>近 7 天消耗</small><b>{weekKcal}</b><small>大卡</small></div>
      </section>

      <section className="card">
        <div className="grid2">
          <label className="field">日期<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field">運動
            <select value={act} onChange={(e) => setAct(e.target.value)}>
              {ACTIVITIES.map((a) => <option key={a.name}>{a.name}</option>)}
              <option>其他</option>
            </select>
          </label>
          {act === '其他' && <label className="field">名稱<input value={custom} onChange={(e) => setCustom(e.target.value)} /></label>}
          <label className="field">時間 (分鐘)<input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></label>
          <label className="field">消耗 (大卡)<input inputMode="numeric" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} placeholder={act === '其他' ? '請輸入' : `估計 ${est}`} /></label>
        </div>
        <p className="note">有運動手錶的話，可以直接填手錶顯示的消耗。</p>
        <button className="primary block" onClick={save}>記錄 {kcal} 大卡</button>
      </section>

      <section className="card">
        <b>最近 30 天</b>
        {recent.map((e) => (
          <div className="log" key={e.id}>
            <div><div>{e.name}</div><small className="muted">{fmtDate(e.date)}{e.minutes ? `・${e.minutes} 分鐘` : ''}</small></div>
            <div className="row"><span>{e.kcal}</span><button className="del" onClick={() => remove(e.id)} aria-label="刪除">✕</button></div>
          </div>
        ))}
        {recent.length === 0 && <p className="muted center">還沒有紀錄</p>}
      </section>

      <p className="note">
        運動消耗會以 {Math.round(addBack * 100)}% 加回當天可吃的熱量（可在「我的」調整）。估算值通常偏高，所以預設只加回一半。
        網頁 App 無法讀取 Apple 健康或 Google Fit，請手動輸入手錶上的數字。
      </p>
    </>
  )
}
